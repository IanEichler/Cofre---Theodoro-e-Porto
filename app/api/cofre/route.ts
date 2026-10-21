import { seal, unseal } from "../../security";
import {
  runtime,
  database,
  fail,
  response,
  authorize,
  log,
  safeMember,
  validString,
  handleAuth,
  getAuthState,
  type Member,
} from "../../auth-server";
export const dynamic = "force-dynamic";
function canRead(row: any, id: string) {
  return row.scope === "team" || row.owner === id;
}
async function state(req: Request) {
  const { u, m, db } = await authorize(req);
  const workspace = await db
    .prepare("SELECT name FROM workspace WHERE id='office'")
    .first();
  const rows = (
    await db
      .prepare(
        "SELECT * FROM items WHERE scope='team' OR owner=? ORDER BY updated DESC LIMIT 1000",
      )
      .bind(u.id)
      .all()
  ).results;
  const favs = new Set(
    (
      await db
        .prepare("SELECT item_id FROM favorites WHERE user_id=?")
        .bind(u.id)
        .all<{ item_id: string }>()
    ).results.map((r) => r.item_id),
  );
  const items = await Promise.all(
    rows.map(async (r: any) => ({
      ...(await unseal(
        r.cipher,
        runtime().COFRE_ENCRYPTION_KEY,
        "item:" + r.id,
      )),
      id: r.id,
      scope: r.scope,
      vault: r.vault,
      created: r.created,
      updated: r.updated,
      deleted: r.deleted,
      version: r.version,
      favorite: favs.has(r.id),
      canEdit: r.scope === "personal" ? r.owner === u.id : m.role !== "reader",
    })),
  );
  const members =
    m.role === "admin"
      ? (
          await db
            .prepare(
              "SELECT email,name,role,status,totp FROM members ORDER BY created",
            )
            .all<Member>()
        ).results.map(safeMember)
      : [];
  const activity = (
    await db
      .prepare(
        "SELECT actor,action,target,time FROM audit WHERE actor=? OR ?='admin' ORDER BY time DESC LIMIT 80",
      )
      .bind(u.email, m.role)
      .all()
  ).results;
  return {
    phase: "open",
    user: safeMember(m),
    workspace: workspace?.name || "Meu escritório",
    items,
    members,
    activity,
  };
}
export async function GET(req: Request) {
  return getAuthState(req, () => state(req));
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || origin !== new URL(req.url).origin)
      fail("Origem da solicitação inválida.", 403);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 200000)
      fail("Solicitação muito grande.", 413);
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      fail("Solicitação inválida.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail("Solicitação inválida.");
    const { op } = body;
    const authResponse = await handleAuth(req, body);
    if (authResponse) return authResponse;
    const { u, m, db } = await authorize(req);
    if (op === "save") {
      const value = body.item || {};
      const id = validString(value.id, 50) || crypto.randomUUID();
      const existing = await db
        .prepare("SELECT * FROM items WHERE id=?")
        .bind(id)
        .first<any>();
      if (existing && !canRead(existing, u.id))
        fail("Você não tem acesso a este item.", 403);
      if (existing && existing.scope === "team" && m.role === "reader")
        fail("Seu perfil permite apenas leitura.", 403);
      const scope = value.scope === "personal" ? "personal" : "team";
      if (scope === "team" && m.role === "reader")
        fail("Seu perfil permite apenas leitura.", 403);
      const payload = {
        title: validString(value.title, 120),
        username: validString(value.username, 200),
        password:
          typeof value.password === "string"
            ? value.password.slice(0, 2000)
            : "",
        url: validString(value.url, 1000),
        notes: validString(value.notes, 10000),
        kind: ["login", "note", "card"].includes(value.kind)
          ? value.kind
          : "login",
        tags: Array.isArray(value.tags)
          ? value.tags.slice(0, 10).map((s: unknown) => validString(s, 30))
          : [],
      };
      if (!payload.title) fail("Informe o nome do item.");
      if (payload.url && !/^https?:\/\//i.test(payload.url))
        fail("Use uma URL que comece com https:// ou http://.");
      const cipher = await seal(
          payload,
          runtime().COFRE_ENCRYPTION_KEY,
          "item:" + id,
        ),
        now = Date.now(),
        vault = validString(value.vault, 60) || "Geral";
      if (existing) {
        const result = await db
          .prepare(
            "UPDATE items SET cipher=?,scope=?,vault=?,updated=?,version=version+1 WHERE id=? AND version=?",
          )
          .bind(cipher, scope, vault, now, id, Number(value.version) || 0)
          .run();
        if (!result.meta.changes)
          fail(
            "Este item foi alterado. Atualize a página antes de editar.",
            409,
          );
      } else
        await db
          .prepare(
            "INSERT INTO items(id,owner,scope,vault,cipher,created,updated,version) VALUES(?,?,?,?,?,?,?,1)",
          )
          .bind(id, u.id, scope, vault, cipher, now, now)
          .run();
      await log(
        db,
        u.email,
        existing ? "Item atualizado" : "Item criado",
        scope === "personal" ? "Item pessoal" : payload.title,
      );
      return response({ ok: true });
    }
    if (["trash", "restore", "delete", "favorite"].includes(op)) {
      const id = validString(body.id, 50);
      const row = await db
        .prepare("SELECT * FROM items WHERE id=?")
        .bind(id)
        .first<any>();
      if (!row || !canRead(row, u.id)) fail("Item não encontrado.", 404);
      if (op === "favorite") {
        const fid = u.id + ":" + id;
        if (body.value)
          await db
            .prepare(
              "INSERT OR IGNORE INTO favorites(id,user_id,item_id) VALUES(?,?,?)",
            )
            .bind(fid, u.id, id)
            .run();
        else
          await db.prepare("DELETE FROM favorites WHERE id=?").bind(fid).run();
        return response({ ok: true });
      }
      if (row.scope === "team" && m.role === "reader")
        fail("Seu perfil permite apenas leitura.", 403);
      if (op === "delete") {
        if (!row.deleted) fail("Mova o item para a lixeira primeiro.");
        await db.batch([
          db.prepare("DELETE FROM items WHERE id=?").bind(id),
          db.prepare("DELETE FROM favorites WHERE item_id=?").bind(id),
        ]);
      } else
        await db
          .prepare(
            "UPDATE items SET deleted=?,updated=?,version=version+1 WHERE id=?",
          )
          .bind(op === "trash" ? Date.now() : null, Date.now(), id)
          .run();
      await log(
        db,
        u.email,
        op === "trash"
          ? "Item movido para a lixeira"
          : op === "restore"
            ? "Item restaurado"
            : "Item excluído permanentemente",
        row.scope === "personal" ? "Item pessoal" : "Cofre da equipe",
      );
      return response({ ok: true });
    }
    if (op === "member") {
      if (m.role !== "admin")
        fail("Apenas administradores podem gerenciar a equipe.", 403);
      const email = validString(body.email, 200).toLowerCase();
      if (email === m.email) fail("Você não pode alterar seu próprio acesso.");
      const person = await db
        .prepare("SELECT * FROM members WHERE email=?")
        .bind(email)
        .first<Member>();
      if (!person) fail("Usuário não encontrado.", 404);
      const role = ["admin", "editor", "reader"].includes(body.role)
        ? body.role
        : person.role;
      const status = body.revoke ? "revoked" : person.status;
      await db.batch([
        db
          .prepare(
            "UPDATE members SET role=?,status=?,invite_hash=NULL,invite_expires=NULL WHERE email=?",
          )
          .bind(role, status, email),
        db
          .prepare("DELETE FROM sessions WHERE user_id=?")
          .bind(person.user_id || ""),
      ]);
      await log(
        db,
        u.email,
        body.revoke ? "Acesso revogado" : "Permissão alterada",
        email,
      );
      return response({ ok: true });
    }
    if (op === "workspace") {
      if (m.role !== "admin")
        fail("Apenas administradores podem alterar o escritório.", 403);
      const name = validString(body.name, 80);
      if (!name) fail("Informe o nome do escritório.");
      await db
        .prepare("UPDATE workspace SET name=? WHERE id='office'")
        .bind(name)
        .run();
      await log(db, u.email, "Configurações atualizadas", name);
      return response({ ok: true });
    }
    fail("Operação não reconhecida.");
  } catch (e: any) {
    return response(
      {
        error: e.status
          ? e.message
          : "Não foi possível concluir a ação. Tente novamente.",
      },
      e.status || 500,
    );
  }
}
