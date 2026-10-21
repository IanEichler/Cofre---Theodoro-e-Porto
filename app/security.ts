const encoder = new TextEncoder();
export function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
export function unb64(text: string) { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); }
export function randomToken(size=32) { return b64(crypto.getRandomValues(new Uint8Array(size))).replaceAll("+","-").replaceAll("/","_").replaceAll("=",""); }
export async function sha(text: string) { return b64(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(text)))); }
export async function seal(value: unknown, secret: string, context: string) {
  const key = await crypto.subtle.importKey("raw",unb64(secret),"AES-GCM",false,["encrypt"]);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode(context)},key,encoder.encode(JSON.stringify(value)));
  return b64(iv)+"."+b64(new Uint8Array(cipher));
}
export async function unseal(value: string, secret: string, context: string) {
  const [iv,cipher]=value.split(".");
  const key=await crypto.subtle.importKey("raw",unb64(secret),"AES-GCM",false,["decrypt"]);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(iv),additionalData:encoder.encode(context)},key,unb64(cipher))));
}
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newTotpSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), n=>alphabet[n&31]).join("");
}
export function decodeBase32(secret: string) {
  let bits=0,value=0; const out:number[]=[];
  for(const ch of secret.toUpperCase().replaceAll("=","")){const digit=alphabet.indexOf(ch);if(digit<0)throw new Error("Invalid base32");value=(value<<5)|digit;bits+=5;if(bits>=8){bits-=8;out.push((value>>>bits)&255);}}
  return new Uint8Array(out);
}
export async function totp(secret:string, step:number, digits=6) {
  const bytes=new Uint8Array(8);new DataView(bytes.buffer).setBigUint64(0,BigInt(step));
  const key=await crypto.subtle.importKey("raw",decodeBase32(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,bytes));const off=sig[19]&15;
  const code=(((sig[off]&127)<<24)|(sig[off+1]<<16)|(sig[off+2]<<8)|sig[off+3])%10**digits;
  return String(code).padStart(digits,"0");
}
export async function matchTotp(secret:string,code:string,lastStep:number,time=Date.now()) {
  if(!/^\d{6}$/.test(code))return null;
  const now=Math.floor(time/30000);
  for(const step of [now,now-1,now+1])if(step>lastStep && await totp(secret,step)===code)return step;
  return null;
}
