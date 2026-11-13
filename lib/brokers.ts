import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {db} from './server';
import {sameOrigin,unseal,parseAccounts,accountResponseShape} from './broker-security';
export const brokerEnv=()=>env as unknown as Record<string,string>;
export const callbackUrl=()=>`${brokerEnv().BROKER_SITE_ORIGIN}/api/broker/deriv/callback`;
export async function brokerUser(r?:Request){const user=await getChatGPTUser();if(!user)throw Error('Sign in to connect your trading accounts.');if(r)sameOrigin(r);return user.userId;}
export function brokerJson(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
export function brokerError(e:unknown){return brokerJson({error:e instanceof Error?e.message:'Account connection unavailable.'},400);}
export async function brokerToken(uid:string){const row=await db().prepare('SELECT ciphertext,expires FROM broker_tokens WHERE user_id=?').bind(uid).first<{ciphertext:string;expires:number}>();if(!row||row.expires<Date.now()+10000)throw Error('Deriv authorization has expired. Reconnect your account.');return unseal(row.ciphertext,brokerEnv().BROKER_TOKEN_KEY,uid);}
export async function derivRequest(token:string,path:string,method='GET'){const r=await fetch('https://api.derivws.com'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(r.status===401?'Deriv authorization expired. Reconnect your account.':`Deriv could not complete the request (${r.status}).`);return r.json() as Promise<any>;}
export async function accounts(uid:string){const data=await derivRequest(await brokerToken(uid),'/trading/v1/options/accounts');try{const rows=parseAccounts(data);if(rows.some(a=>a.type==='unknown'||a.balance===null||a.currency===null||a.status==='unknown'))console.warn('Deriv account fields incomplete',JSON.stringify(accountResponseShape(data)));return rows}catch(e){console.error('Deriv account shape rejected',JSON.stringify(accountResponseShape(data)));throw e}}
