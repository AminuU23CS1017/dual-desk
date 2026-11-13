const encoder=new TextEncoder();
export const randomSecret=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function digest(value:string){return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function key(secret:string){if(!/^[a-f0-9]{64}$/.test(secret))throw Error('Account encryption is not configured.');return crypto.subtle.importKey('raw',new Uint8Array(secret.match(/../g)!.map(x=>parseInt(x,16))),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value:string,secret:string,user:string){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(user)},await key(secret),encoder.encode(value));return btoa(String.fromCharCode(...iv,...new Uint8Array(data)));}
export async function unseal(value:string,secret:string,user:string){const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:encoder.encode(user)},await key(secret),bytes.slice(12)));}
export function sameOrigin(r:Request){if(r.headers.get('origin')!==new URL(r.url).origin)throw Error('Request origin rejected.');}
export function demoSocket(value:string){const u=new URL(value);if(u.protocol!=='wss:'||u.hostname!=='api.derivws.com'||u.pathname!=='/trading/v1/options/ws/demo'||u.username||u.password||u.port)throw Error('Deriv returned an unexpected demo connection.');return u.href;}
// Only structural metadata is logged; never account values or raw broker responses.
export function accountResponseShape(data:any){
 const kind=(v:any):string=>v===null?'null':Array.isArray(v)?'array':typeof v;
 const rows=Array.isArray(data?.data)?data.data:Array.isArray(data?.data?.accounts)?data.data.accounts:Array.isArray(data?.accounts)?data.accounts:Array.isArray(data)?data:null;
 const fields=['account_id','account_type','balance','currency','status'];
 return {root:kind(data),data:kind(data?.data),accounts:kind(data?.accounts),nestedAccounts:kind(data?.data?.accounts),rows:rows?.length??null,first:rows?.length?Object.fromEntries(fields.map(k=>[k,kind(rows[0]?.[k])])):null};
}
function accountBalance(value:unknown):number|null{
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 if(typeof value!=='string'||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))return null;
 const number=Number(value.trim());return Number.isFinite(number)?number:null;
}
export function parseAccounts(data:any):Array<{id:string;type:'demo'|'real'|'unknown';balance:number|null;currency:string|null;status:'active'|'inactive'|'unknown'}>{
 const rows=Array.isArray(data?.data)?data.data:Array.isArray(data?.data?.accounts)?data.data.accounts:Array.isArray(data?.accounts)?data.accounts:Array.isArray(data)?data:null;
 if(!rows)throw Error('Deriv account list format was not recognized. Your authorization can remain connected; try Refresh connection.');
 const seen=new Set<string>();
 return rows.map((a:any)=>{
  if(!a||typeof a.account_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(a.account_id)||seen.has(a.account_id))throw Error('Deriv returned an account identifier the site could not verify. Account actions are unavailable.');
  seen.add(a.account_id);
  // Never infer demo status from an ID prefix or a missing account type.
  const type=a.account_type==='demo'?'demo':a.account_type==='real'?'real':'unknown';
  const balance=accountBalance(a.balance);
  const currency=typeof a.currency==='string'&&/^[A-Za-z0-9]{2,12}$/.test(a.currency)?a.currency:null;
  const status=a.status==='active'?'active':a.status==='inactive'?'inactive':'unknown';
  return {id:a.account_id,type,balance,currency,status};
 });
}
