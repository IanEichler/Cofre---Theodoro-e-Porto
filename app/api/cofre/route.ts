import { env } from "cloudflare:workers";
import { b64, randomToken, sha, seal, unseal, newTotpSecret, matchTotp } from "../../security";
export const dynamic="force-dynamic";
type Member={email:string;user_id:string|null;name:string;role:string;status:string;totp:string|null;pending:string|null;last_step:number;attempts:number;locked_until:number;recovery:string|null};
const runtime=()=>env as unknown as {DB:D1Database;COFRE_ENCRYPTION_KEY:string};
function fail(message:string,status=400):never {throw Object.assign(new Error(message),{status});}
function response(data:unknown,status=200,cookie?:string){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff",...(cookie?{"Set-Cookie":cookie}:{})}});}
function identity(req:Request){const id=req.headers.get("oai-authenticated-user-id"),email=req.headers.get("oai-authenticated-user-email")?.toLowerCase();if(!id||!email)fail("Entre com sua conta para continuar.",401);return {id,email};}
function database(){const {DB,COFRE_ENCRYPTION_KEY}=runtime();if(!DB||!COFRE_ENCRYPTION_KEY)fail("O armazenamento seguro ainda não está disponível. Tente novamente em instantes.",503);return DB;}
async function memberFor(req:Request){const u=identity(req);const db=database();const m=await db.prepare("SELECT * FROM members WHERE email = ?").bind(u.email).first<Member>();if(!m||m.status==="revoked"||(m.user_id&&m.user_id!==u.id))fail("Sua conta não tem acesso a este escritório.",403);return {u,m,db};}
function sessionToken(req:Request){return req.headers.get("cookie")?.split(";").map(v=>v.trim()).find(v=>v.startsWith("cofre_session="))?.slice(14);}
async function authorize(req:Request){const result=await memberFor(req);if(!result.m.totp)fail("Configure o Google Authenticator para continuar.",403);const token=sessionToken(req);if(!token)fail("Desbloqueie seu cofre.",423);const session=await result.db.prepare("SELECT hash FROM sessions WHERE hash=? AND user_id=? AND expires>?").bind(await sha(token),result.u.id,Date.now()).first();if(!session)fail("Sua sessão expirou. Desbloqueie seu cofre.",423);return result;}
async function log(db:D1Database,actor:string,action:string,target:string){await db.prepare("INSERT INTO audit(id,actor,action,target,time) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),actor,action,target,Date.now()).run();}
const safeMember=(m:Member)=>({email:m.email,name:m.name,role:m.role,status:m.status,twoFactor:!!m.totp});
function validString(v:unknown,max=200){return typeof v==="string"?v.trim().slice(0,max):"";}
function canRead(row:any,id:string){return row.scope==="team"||row.owner===id;}
async function state(req:Request){
 const {u,m,db}=await authorize(req);const workspace=await db.prepare("SELECT name FROM workspace WHERE id='office'").first();
 const rows=(await db.prepare("SELECT * FROM items WHERE scope='team' OR owner=? ORDER BY updated DESC LIMIT 1000").bind(u.id).all()).results;
 const favs=new Set((await db.prepare("SELECT item_id FROM favorites WHERE user_id=?").bind(u.id).all<{item_id:string}>()).results.map(r=>r.item_id));
 const items=await Promise.all(rows.map(async(r:any)=>({...await unseal(r.cipher,runtime().COFRE_ENCRYPTION_KEY,"item:"+r.id),id:r.id,scope:r.scope,vault:r.vault,created:r.created,updated:r.updated,deleted:r.deleted,version:r.version,favorite:favs.has(r.id),canEdit:r.scope==="personal"?r.owner===u.id:m.role!=="reader"})));
 const members=m.role==="admin"?(await db.prepare("SELECT email,name,role,status,totp FROM members ORDER BY created").all<Member>()).results.map(safeMember):[];
 const activity=(await db.prepare("SELECT actor,action,target,time FROM audit WHERE actor=? OR ?='admin' ORDER BY time DESC LIMIT 80").bind(u.email,m.role).all()).results;
 return {phase:"open",user:safeMember(m),workspace:workspace?.name||"Meu escritório",items,members,activity};
}
export async function GET(req:Request){try{
 const {id,email}=identity(req);const db=database();const ws=await db.prepare("SELECT id FROM workspace WHERE id='office'").first();if(!ws)return response({phase:"new",identity:{email}});
 const m=await db.prepare("SELECT * FROM members WHERE email=?").bind(email).first<Member>();if(!m||m.status==="revoked"||(m.user_id&&m.user_id!==id))return response({phase:"forbidden",identity:{email}});
 if(!m.totp)return response({phase:"enroll",user:safeMember(m)});
 try{return response(await state(req));}catch(e:any){if(e.status===423)return response({phase:"locked",user:safeMember(m)});throw e;}
}catch(e:any){return response({error:e.status?e.message:"Não foi possível acessar o cofre.",phase:e.status===401?"signin":"error"},e.status||500);}}
export async function POST(req:Request){try{
 const origin=req.headers.get("origin");if(!origin||origin!==new URL(req.url).origin)fail("Origem da solicitação inválida.",403);
 if(Number(req.headers.get("content-length")||0)>200000)fail("Solicitação muito grande.",413);
 const body=await req.json() as any;const {op}=body;
 if(op==="initialize"){
   const u=identity(req),db=database();const name=validString(body.name,80)||"Meu escritório";
   const created=await db.prepare("INSERT OR IGNORE INTO workspace(id,name,creator,created) VALUES('office',?,?,?)").bind(name,u.id,Date.now()).run();
   const ws=await db.prepare("SELECT creator FROM workspace WHERE id='office'").first<{creator:string}>();if(ws?.creator!==u.id)fail("O escritório já foi configurado.",403);
   await db.prepare("INSERT OR IGNORE INTO members(email,user_id,name,role,status,created) VALUES(?,?,?,'admin','active',?)").bind(u.email,u.id,validString(body.userName,80)||u.email.split("@")[0],Date.now()).run();
   if(created.meta.changes)await log(db,u.email,"Escritório criado",name);return response({phase:"enroll"});
 }
 if(op==="enroll"){
   const {u,m,db}=await memberFor(req);if(m.totp)fail("A verificação em duas etapas já está ativa.");
   const secret=m.pending?await unseal(m.pending,runtime().COFRE_ENCRYPTION_KEY,"totp:"+m.email):newTotpSecret();
   await db.prepare("UPDATE members SET pending=?,user_id=?,status='active' WHERE email=? AND totp IS NULL AND (user_id IS NULL OR user_id=?)").bind(await seal(secret,runtime().COFRE_ENCRYPTION_KEY,"totp:"+m.email),u.id,m.email,u.id).run();
   return response({secret,uri:`otpauth://totp/Cofre:${encodeURIComponent(m.email)}?secret=${secret}&issuer=Cofre&algorithm=SHA1&digits=6&period=30`});
 }
 if(op==="verify"){
   const {u,m,db}=await memberFor(req);const now=Date.now();if(m.locked_until>now)fail("Muitas tentativas. Aguarde cinco minutos.",429);
   const limit=await db.prepare("UPDATE members SET attempts=CASE WHEN locked_until>0 AND locked_until<=? THEN 1 ELSE attempts+1 END,locked_until=CASE WHEN locked_until>0 AND locked_until<=? THEN 0 ELSE locked_until END WHERE email=? AND (attempts<8 OR (locked_until>0 AND locked_until<=?)) RETURNING attempts").bind(now,now,m.email,now).first<{attempts:number}>();
   if(!limit){await db.prepare("UPDATE members SET locked_until=? WHERE email=? AND locked_until=0").bind(now+300000,m.email).run();fail("Muitas tentativas. Aguarde cinco minutos.",429);}
   const code=validString(body.code,80).replaceAll(" ","");let step:number|null=null;let recoveryList:string[]|null=null;
   const encrypted=m.totp||m.pending;if(!encrypted)fail("Inicie a configuração do autenticador.");
   if(/^\d{6}$/.test(code))step=await matchTotp(await unseal(encrypted,runtime().COFRE_ENCRYPTION_KEY,"totp:"+m.email),code,m.last_step);
   else if(m.totp&&m.recovery){const hash=await sha(code.toUpperCase());const list=JSON.parse(m.recovery) as string[];if(list.includes(hash))recoveryList=list.filter(v=>v!==hash);}
   if(step===null&&!recoveryList){if(limit.attempts>=8)await db.prepare("UPDATE members SET locked_until=? WHERE email=?").bind(now+300000,m.email).run();fail("Código inválido ou já utilizado. Use o próximo código.",401);}
   let recoveryCodes:string[]=[];let hashes=m.recovery;
   if(!m.totp){recoveryCodes=Array.from({length:10},()=>randomToken(12).toUpperCase());hashes=JSON.stringify(await Promise.all(recoveryCodes.map(sha)));}
   if(recoveryList)hashes=JSON.stringify(recoveryList);
   const changed=await db.prepare("UPDATE members SET totp=?,pending=NULL,last_step=?,attempts=0,locked_until=0,recovery=?,user_id=?,status='active' WHERE email=? AND last_step=? AND recovery IS ? AND (user_id IS NULL OR user_id=?)").bind(encrypted,step??m.last_step,hashes,u.id,m.email,m.last_step,m.recovery,u.id).run();
   if(!changed.meta.changes)fail("Código já utilizado. Tente o próximo código.",401);
   const token=randomToken();await db.batch([db.prepare("DELETE FROM sessions WHERE expires<?").bind(now),db.prepare("INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)").bind(await sha(token),u.id,now+900000)]);
   await log(db,u.email,recoveryList?"Acesso com código de recuperação":"Cofre desbloqueado","Verificação em duas etapas");
   const secure=new URL(req.url).protocol==="https:"?" Secure;":"";
   return response({ok:true,recoveryCodes},200,`cofre_session=${token}; HttpOnly;${secure} SameSite=Strict; Path=/; Max-Age=900`);
 }
 if(op==="lock"){
   const u=identity(req),db=database(),token=sessionToken(req);if(token)await db.prepare("DELETE FROM sessions WHERE hash=? AND user_id=?").bind(await sha(token),u.id).run();
   return response({ok:true},200,"cofre_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
 }
 const {u,m,db}=await authorize(req);
 if(op==="save"){
   const value=body.item||{};const id=validString(value.id,50)||crypto.randomUUID();const existing=await db.prepare("SELECT * FROM items WHERE id=?").bind(id).first<any>();
   if(existing&&!canRead(existing,u.id))fail("Você não tem acesso a este item.",403);
   if(existing&&existing.scope==="team"&&m.role==="reader")fail("Seu perfil permite apenas leitura.",403);
   const scope=value.scope==="personal"?"personal":"team";if(scope==="team"&&m.role==="reader")fail("Seu perfil permite apenas leitura.",403);
   const payload={title:validString(value.title,120),username:validString(value.username,200),password:typeof value.password==="string"?value.password.slice(0,2000):"",url:validString(value.url,1000),notes:validString(value.notes,10000),kind:["login","note","card"].includes(value.kind)?value.kind:"login",tags:Array.isArray(value.tags)?value.tags.slice(0,10).map((s:unknown)=>validString(s,30)):[]};
   if(!payload.title)fail("Informe o nome do item.");if(payload.url&&!/^https?:\/\//i.test(payload.url))fail("Use uma URL que comece com https:// ou http://.");
   const cipher=await seal(payload,runtime().COFRE_ENCRYPTION_KEY,"item:"+id),now=Date.now(),vault=validString(value.vault,60)||"Geral";
   if(existing){const result=await db.prepare("UPDATE items SET cipher=?,scope=?,vault=?,updated=?,version=version+1 WHERE id=? AND version=?").bind(cipher,scope,vault,now,id,Number(value.version)||0).run();if(!result.meta.changes)fail("Este item foi alterado. Atualize a página antes de editar.",409);}
   else await db.prepare("INSERT INTO items(id,owner,scope,vault,cipher,created,updated,version) VALUES(?,?,?,?,?,?,?,1)").bind(id,u.id,scope,vault,cipher,now,now).run();
   await log(db,u.email,existing?"Item atualizado":"Item criado",scope==="personal"?"Item pessoal":payload.title);return response({ok:true});
 }
 if(["trash","restore","delete","favorite"].includes(op)){
   const id=validString(body.id,50);const row=await db.prepare("SELECT * FROM items WHERE id=?").bind(id).first<any>();if(!row||!canRead(row,u.id))fail("Item não encontrado.",404);
   if(op==="favorite"){const fid=u.id+":"+id;if(body.value)await db.prepare("INSERT OR IGNORE INTO favorites(id,user_id,item_id) VALUES(?,?,?)").bind(fid,u.id,id).run();else await db.prepare("DELETE FROM favorites WHERE id=?").bind(fid).run();return response({ok:true});}
   if(row.scope==="team"&&m.role==="reader")fail("Seu perfil permite apenas leitura.",403);
   if(op==="delete"){if(!row.deleted)fail("Mova o item para a lixeira primeiro.");await db.batch([db.prepare("DELETE FROM items WHERE id=?").bind(id),db.prepare("DELETE FROM favorites WHERE item_id=?").bind(id)]);}
   else await db.prepare("UPDATE items SET deleted=?,updated=?,version=version+1 WHERE id=?").bind(op==="trash"?Date.now():null,Date.now(),id).run();
   await log(db,u.email,op==="trash"?"Item movido para a lixeira":op==="restore"?"Item restaurado":"Item excluído permanentemente",row.scope==="personal"?"Item pessoal":"Cofre da equipe");return response({ok:true});
 }
 if(op==="invite"){
   if(m.role!=="admin")fail("Apenas administradores podem gerenciar a equipe.",403);const email=validString(body.email,200).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail("Informe um e-mail válido.");
   const role=["admin","editor","reader"].includes(body.role)?body.role:"reader";const existing=await db.prepare("SELECT email FROM members WHERE email=?").bind(email).first();if(existing)fail("Este e-mail já faz parte da equipe.");
   await db.prepare("INSERT INTO members(email,name,role,status,created) VALUES(?,?,?,'invited',?)").bind(email,validString(body.name,80)||email.split("@")[0],role,Date.now()).run();await log(db,u.email,"Acesso autorizado",email);return response({ok:true});
 }
 if(op==="member"){
   if(m.role!=="admin")fail("Apenas administradores podem gerenciar a equipe.",403);const email=validString(body.email,200).toLowerCase();if(email===m.email)fail("Você não pode alterar seu próprio acesso.");
   const person=await db.prepare("SELECT * FROM members WHERE email=?").bind(email).first<Member>();if(!person)fail("Usuário não encontrado.",404);
   const role=["admin","editor","reader"].includes(body.role)?body.role:person.role;const status=body.revoke?"revoked":person.status;
   await db.batch([db.prepare("UPDATE members SET role=?,status=? WHERE email=?").bind(role,status,email),db.prepare("DELETE FROM sessions WHERE user_id=?").bind(person.user_id||"")]);await log(db,u.email,body.revoke?"Acesso revogado":"Permissão alterada",email);return response({ok:true});
 }
 if(op==="workspace"){
   if(m.role!=="admin")fail("Apenas administradores podem alterar o escritório.",403);const name=validString(body.name,80);if(!name)fail("Informe o nome do escritório.");await db.prepare("UPDATE workspace SET name=? WHERE id='office'").bind(name).run();await log(db,u.email,"Configurações atualizadas",name);return response({ok:true});
 }
 fail("Operação não reconhecida.");
}catch(e:any){return response({error:e.status?e.message:"Não foi possível concluir a ação. Tente novamente."},e.status||500);}}
