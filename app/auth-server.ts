import { env } from "cloudflare:workers";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import {
  randomToken,
  sha,
  seal,
  unseal,
  newTotpSecret,
  matchTotp,
} from "./security";
import { hashPassword, verifyPassword, validatePassword } from "./passwords";
import { ORGANIZATION_NAME } from "./organization";

export type Member = {
  email: string;
  user_id: string;
  name: string;
  role: string;
  status: string;
  totp: string | null;
  pending: string | null;
  last_step: number;
  attempts: number;
  locked_until: number;
  recovery: string | null;
  password_hash: string | null;
  invite_hash: string | null;
  invite_expires: number | null;
  auth_version: number;
};
export const runtime = () =>
  env as unknown as {
    DB: D1Database;
    COFRE_ENCRYPTION_KEY: string;
    COFRE_BOOTSTRAP_HASH: string;
    COFRE_BOOTSTRAP_EMAIL: string;
    COFRE_BOOTSTRAP_EXPIRES: string;
  };
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export function response(data: unknown, status = 200, cookies: string[] = []) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(JSON.stringify(data), { status, headers });
}
export function database() {
  const config = runtime();
  if (!config.DB || !config.COFRE_ENCRYPTION_KEY)
    fail(
      "O armazenamento seguro está indisponível. Tente novamente em instantes.",
      503,
    );
  return config.DB;
}
export const validString = (value: unknown, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const emailValue = (value: unknown) => validString(value, 200).toLowerCase();
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const safeMember = (member: Member) => ({
  email: member.email,
  name: member.name,
  role: member.role,
  status: member.status,
  twoFactor: !!member.totp,
});
export async function log(
  db: D1Database,
  actor: string,
  action: string,
  target: string,
) {
  await db
    .prepare("INSERT INTO audit(id,actor,action,target,time) VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(), actor, action, target, Date.now())
    .run();
}
const cookieToken = (request: Request, name: string) =>
  request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + "="))
    ?.slice(name.length + 1);
function cookie(request: Request, name: string, token: string, maxAge: number) {
  return `${name}=${token}; HttpOnly;${new URL(request.url).protocol === "https:" ? " Secure;" : ""} SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
const clearCookies = (request: Request) => [
  cookie(request, "cofre_session", "", 0),
  cookie(request, "cofre_auth", "", 0),
];
async function findSession(request: Request, stage: "password" | "full") {
  const token = cookieToken(
    request,
    stage === "full" ? "cofre_session" : "cofre_auth",
  );
  if (!token || token.length > 100) return null;
  return database()
    .prepare(
      "SELECT m.* FROM sessions s JOIN members m ON m.user_id=s.user_id WHERE s.hash=? AND s.stage=? AND s.expires>? AND s.auth_version=m.auth_version AND m.status='active' AND m.password_hash IS NOT NULL",
    )
    .bind(await sha(token), stage, Date.now())
    .first<Member>();
}
export async function authorize(request: Request) {
  const m = await findSession(request, "full");
  if (!m || !m.totp)
    fail("Sua sessão expirou. Entre novamente com e-mail e senha.", 423);
  return { m, u: { id: m.user_id, email: m.email }, db: database() };
}
async function challengeMember(request: Request) {
  const member = await findSession(request, "password");
  if (!member)
    fail("Entre com e-mail e senha antes de informar o segundo fator.", 401);
  return member;
}
async function removeBrowserSessions(request: Request) {
  const db = database();
  const tokens = [
    cookieToken(request, "cofre_auth"),
    cookieToken(request, "cofre_session"),
  ].filter(Boolean) as string[];
  if (tokens.length)
    await db.batch(
      await Promise.all(
        tokens.map(async (token) =>
          db
            .prepare("DELETE FROM sessions WHERE hash=?")
            .bind(await sha(token)),
        ),
      ),
    );
}
async function issueChallenge(request: Request, member: Member) {
  await removeBrowserSessions(request);
  const token = randomToken();
  await database().batch([
    database().prepare("DELETE FROM sessions WHERE expires<?").bind(Date.now()),
    database()
      .prepare(
        "INSERT INTO sessions(hash,user_id,expires,stage,auth_version) VALUES(?,?,?,'password',?)",
      )
      .bind(
        await sha(token),
        member.user_id,
        Date.now() + 300000,
        member.auth_version,
      ),
  ]);
  return response(
    { phase: member.totp ? "locked" : "enroll", user: safeMember(member) },
    200,
    [
      cookie(request, "cofre_auth", token, 300),
      cookie(request, "cofre_session", "", 0),
    ],
  );
}
async function throttle(request: Request, account?: string) {
  const db = database(),
    now = Date.now(),
    period = 900000;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const keys = [{ key: "ip:" + (await sha(ip)), max: 80 }];
  if (account) keys.push({ key: "account:" + (await sha(account)), max: 8 });
  const rows = await db.batch(
    keys.map(({ key }) =>
      db
        .prepare(
          "INSERT INTO auth_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN ? ELSE expires END RETURNING count",
        )
        .bind(key, now + period, now, now, now + period),
    ),
  );
  if (
    rows.some((row, i) => Number((row.results[0] as any)?.count) > keys[i].max)
  )
    fail(
      "Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente.",
      429,
    );
}
async function bootstrapInfo(token: unknown) {
  const config = runtime();
  const supplied =
    typeof token === "string" && token.length <= 200 ? await sha(token) : "";
  const expected = config.COFRE_BOOTSTRAP_HASH || "";
  if (
    !expected ||
    expected.length !== supplied.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)) ||
    Date.now() > Number(config.COFRE_BOOTSTRAP_EXPIRES || 0)
  )
    fail("O link de configuração é inválido ou expirou.", 403);
  if (
    await database()
      .prepare("SELECT id FROM workspace WHERE id='office'")
      .first()
  )
    fail("O acesso inicial já foi configurado. Entre com seu e-mail e senha.", 409);
  return emailValue(config.COFRE_BOOTSTRAP_EMAIL);
}
async function invitationMember(token: unknown) {
  if (typeof token !== "string" || token.length < 32 || token.length > 200)
    fail("O convite é inválido ou expirou.", 403);
  const member = await database()
    .prepare(
      "SELECT * FROM members WHERE invite_hash=? AND invite_expires>? AND status!='revoked'",
    )
    .bind(await sha(token), Date.now())
    .first<Member>();
  if (!member) fail("O convite é inválido, já foi usado ou expirou.", 403);
  return member;
}
async function consumeSecondFactor(member: Member, codeInput: unknown) {
  const db = database(),
    now = Date.now();
  if (member.locked_until > now)
    fail("Muitas tentativas. Aguarde cinco minutos.", 429);
  const limit = await db
    .prepare(
      "UPDATE members SET attempts=CASE WHEN locked_until>0 AND locked_until<=? THEN 1 ELSE attempts+1 END,locked_until=CASE WHEN locked_until>0 AND locked_until<=? THEN 0 ELSE locked_until END WHERE email=? AND (attempts<8 OR (locked_until>0 AND locked_until<=?)) RETURNING attempts",
    )
    .bind(now, now, member.email, now)
    .first<{ attempts: number }>();
  if (!limit) {
    await db
      .prepare(
        "UPDATE members SET locked_until=? WHERE email=? AND locked_until=0",
      )
      .bind(now + 300000, member.email)
      .run();
    fail("Muitas tentativas. Aguarde cinco minutos.", 429);
  }
  const code = validString(codeInput, 80).replaceAll(" ", ""),
    encrypted = member.totp || member.pending;
  if (!encrypted) fail("Inicie a configuração do autenticador.");
  let step: number | null = null,
    remaining: string[] | null = null;
  if (/^\d{6}$/.test(code))
    step = await matchTotp(
      await unseal(
        encrypted,
        runtime().COFRE_ENCRYPTION_KEY,
        "totp:" + member.email,
      ),
      code,
      member.last_step,
    );
  else if (member.totp && member.recovery) {
    const hash = await sha(code.toUpperCase()),
      codes = JSON.parse(member.recovery) as string[];
    if (codes.includes(hash))
      remaining = codes.filter((value) => value !== hash);
  }
  if (step === null && !remaining) {
    if (limit.attempts >= 8)
      await db
        .prepare("UPDATE members SET locked_until=? WHERE email=?")
        .bind(now + 300000, member.email)
        .run();
    fail("Código inválido ou já utilizado. Use o próximo código.", 401);
  }
  let recoveryCodes: string[] = [],
    recovery = member.recovery;
  if (!member.totp) {
    recoveryCodes = Array.from({ length: 10 }, () =>
      randomToken(12).toUpperCase(),
    );
    recovery = JSON.stringify(await Promise.all(recoveryCodes.map(sha)));
  }
  if (remaining) recovery = JSON.stringify(remaining);
  const result = await db
    .prepare(
      "UPDATE members SET totp=?,pending=NULL,last_step=?,attempts=0,locked_until=0,recovery=? WHERE email=? AND last_step=? AND recovery IS ? AND auth_version=? AND status='active'",
    )
    .bind(
      encrypted,
      step ?? member.last_step,
      recovery,
      member.email,
      member.last_step,
      member.recovery,
      member.auth_version,
    )
    .run();
  if (!result.meta.changes)
    fail("Código já utilizado ou acesso alterado. Entre novamente.", 401);
  return { recoveryCodes, usedRecovery: !!remaining };
}
export async function getAuthState(
  request: Request,
  openState: () => Promise<unknown>,
) {
  try {
    database();
    if (await findSession(request, "full")) return response(await openState());
    const member = await findSession(request, "password");
    if (member)
      return response({
        phase: member.totp ? "locked" : "enroll",
        user: safeMember(member),
      });
    return response({ phase: "signin" });
  } catch (error: any) {
    return response(
      {
        phase: "error",
        error: error.status
          ? error.message
          : "Não foi possível acessar o Cofre.",
      },
      error.status || 500,
    );
  }
}
export async function handleAuth(
  request: Request,
  body: any,
): Promise<Response | null> {
  const db = database(),
    { op } = body;
  if (op === "setup-info") {
    await throttle(request);
    return response({ email: await bootstrapInfo(body.token) });
  }
  if (op === "invite-info") {
    await throttle(request);
    const member = await invitationMember(body.token);
    return response({
      email: member.email,
      name: member.name,
      reset: !!member.password_hash,
    });
  }
  if (op === "initialize") {
    await throttle(request);
    const email = await bootstrapInfo(body.token);
    validatePassword(body.password);
    const passwordHash = await hashPassword(body.password),
      id = crypto.randomUUID(),
      now = Date.now(),
      userName = validString(body.userName, 80) || email.split("@")[0];
    // Both rows commit together; a second configuration attempt cannot replace the owner.
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO workspace(id,name,creator,created) VALUES('office',?,?,?)",
          )
          .bind(ORGANIZATION_NAME, id, now),
        db
          .prepare(
            "INSERT INTO members(email,user_id,name,role,status,password_hash,auth_version,created) VALUES(?,?,?,'admin','active',?,1,?)",
          )
          .bind(email, id, userName, passwordHash, now),
      ]);
    } catch {
      if (
        await db.prepare("SELECT id FROM workspace WHERE id='office'").first()
      )
        fail("O acesso inicial já foi configurado.", 409);
      throw new Error("Setup failed");
    }
    await log(db, email, "Acesso do administrador configurado", email);
    return issueChallenge(
      request,
      (await db
        .prepare("SELECT * FROM members WHERE email=?")
        .bind(email)
        .first<Member>())!,
    );
  }
  if (op === "login") {
    const email = emailValue(body.email);
    await throttle(request, email);
    const member = await db
      .prepare("SELECT * FROM members WHERE email=?")
      .bind(email)
      .first<Member>();
    const valid = await verifyPassword(
      body.password,
      member?.password_hash || null,
    );
    if (!valid || !member || member.status !== "active")
      fail("E-mail ou senha incorretos.", 401);
    await db
      .prepare("DELETE FROM auth_limits WHERE key=?")
      .bind("account:" + (await sha(email)))
      .run();
    return issueChallenge(request, member);
  }
  if (op === "accept-invite") {
    await throttle(request);
    const member = await invitationMember(body.token);
    validatePassword(body.password);
    const passwordHash = await hashPassword(body.password),
      id = member.user_id || crypto.randomUUID();
    const result = await db
      .prepare(
        "UPDATE members SET password_hash=?,user_id=?,status='active',auth_version=auth_version+1,invite_hash=NULL,invite_expires=NULL WHERE email=? AND invite_hash=? AND invite_expires>? AND status!='revoked'",
      )
      .bind(passwordHash, id, member.email, member.invite_hash, Date.now())
      .run();
    if (!result.meta.changes) fail("O convite já foi usado ou expirou.", 403);
    await db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
    await log(
      db,
      member.email,
      member.password_hash ? "Senha de acesso redefinida" : "Convite aceito",
      "Conta de acesso",
    );
    return issueChallenge(
      request,
      (await db
        .prepare("SELECT * FROM members WHERE email=?")
        .bind(member.email)
        .first<Member>())!,
    );
  }
  if (op === "enroll") {
    const member = await challengeMember(request);
    if (member.totp) fail("A verificação em duas etapas já está ativa.");
    const candidate = await seal(
      newTotpSecret(),
      runtime().COFRE_ENCRYPTION_KEY,
      "totp:" + member.email,
    );
    const saved = await db
      .prepare(
        "UPDATE members SET pending=COALESCE(pending,?) WHERE email=? AND totp IS NULL AND auth_version=? RETURNING pending",
      )
      .bind(candidate, member.email, member.auth_version)
      .first<{ pending: string }>();
    if (!saved) fail("Sua conta foi alterada. Entre novamente.", 401);
    const secret = await unseal(
      saved.pending,
      runtime().COFRE_ENCRYPTION_KEY,
      "totp:" + member.email,
    );
    return response({
      secret,
      uri: `otpauth://totp/Cofre:${encodeURIComponent(member.email)}?secret=${secret}&issuer=Cofre&algorithm=SHA1&digits=6&period=30`,
    });
  }
  if (op === "verify") {
    await throttle(request);
    const member = await challengeMember(request),
      result = await consumeSecondFactor(member, body.code),
      token = randomToken();
    const challenge = cookieToken(request, "cofre_auth")!;
    await db.batch([
      db
        .prepare("DELETE FROM sessions WHERE hash=?")
        .bind(await sha(challenge)),
      db
        .prepare(
          "INSERT INTO sessions(hash,user_id,expires,stage,auth_version) VALUES(?,?,?,'full',?)",
        )
        .bind(
          await sha(token),
          member.user_id,
          Date.now() + 900000,
          member.auth_version,
        ),
    ]);
    await log(
      db,
      member.email,
      result.usedRecovery
        ? "Acesso com código de recuperação"
        : "Cofre desbloqueado",
      "E-mail, senha e segundo fator",
    );
    return response({ ok: true, recoveryCodes: result.recoveryCodes }, 200, [
      cookie(request, "cofre_session", token, 900),
      cookie(request, "cofre_auth", "", 0),
    ]);
  }
  if (op === "lock" || op === "logout") {
    await removeBrowserSessions(request);
    return response({ phase: "signin" }, 200, clearCookies(request));
  }
  if (op === "invite" || op === "reset-account") {
    const { m } = await authorize(request);
    if (m.role !== "admin")
      fail("Apenas administradores podem gerenciar acessos.", 403);
    const email = emailValue(body.email);
    if (!validEmail(email)) fail("Informe um e-mail válido.");
    const existing = await db
      .prepare("SELECT * FROM members WHERE email=?")
      .bind(email)
      .first<Member>();
    if (op === "invite" && existing)
      fail("Este e-mail já faz parte da equipe.");
    if (op === "reset-account" && (!existing || existing.status === "revoked"))
      fail("Usuário não encontrado ou revogado.", 404);
    const token = randomToken(),
      inviteHash = await sha(token),
      expires = Date.now() + (op === "invite" ? 7 * 86400000 : 3600000);
    if (existing)
      await db
        .prepare(
          "UPDATE members SET invite_hash=?,invite_expires=? WHERE email=? AND status!='revoked'",
        )
        .bind(inviteHash, expires, email)
        .run();
    else
      await db
        .prepare(
          "INSERT INTO members(email,user_id,name,role,status,invite_hash,invite_expires,created) VALUES(?,?,?,?,'invited',?,?,?)",
        )
        .bind(
          email,
          crypto.randomUUID(),
          validString(body.name, 80) || email.split("@")[0],
          ["admin", "editor", "reader"].includes(body.role)
            ? body.role
            : "reader",
          inviteHash,
          expires,
          Date.now(),
        )
        .run();
    await log(
      db,
      m.email,
      op === "invite" ? "Convite criado" : "Link de redefinição criado",
      email,
    );
    return response({
      ok: true,
      invitationUrl: new URL(request.url).origin + "/#convite=" + token,
      expires,
    });
  }
  if (op === "change-password") {
    const { m } = await authorize(request);
    await throttle(request, m.email);
    if (!(await verifyPassword(body.currentPassword, m.password_hash)))
      fail("A senha atual está incorreta.", 401);
    validatePassword(body.newPassword);
    await consumeSecondFactor(m, body.code);
    const passwordHash = await hashPassword(body.newPassword);
    await db.batch([
      db
        .prepare(
          "UPDATE members SET password_hash=?,auth_version=auth_version+1,invite_hash=NULL,invite_expires=NULL WHERE email=? AND auth_version=?",
        )
        .bind(passwordHash, m.email, m.auth_version),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(m.user_id),
    ]);
    await log(
      db,
      m.email,
      "Senha de acesso alterada",
      "Todas as sessões encerradas",
    );
    return response({ ok: true, phase: "signin" }, 200, clearCookies(request));
  }
  return null;
}
