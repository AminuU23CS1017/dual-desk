import {db} from '../../../../../lib/server';
import {brokerUser,brokerEnv,callbackUrl} from '../../../../../lib/brokers';
import {digest,seal,unseal} from '../../../../../lib/broker-security';

export async function GET(r:Request){
 let result='failed',stage='site_session',status:number|undefined,providerError:string|undefined;
 const reference=crypto.randomUUID();
 try{
  const uid=await brokerUser(),q=new URL(r.url).searchParams;
  stage='authorization';
  if(q.has('error')){
   const code=q.get('error');
   if(code==='access_denied')stage='access_denied';
   else if(code==='invalid_scope')stage='invalid_scope';
   throw Error('Provider declined authorization');
  }
  const state=q.get('state')??'',code=q.get('code')??'';
  if(!state||state.length>200||!code||code.length>4096)throw Error('Authorization incomplete');
  stage='state';
  const row=await db().prepare('DELETE FROM broker_oauth WHERE user_id=? AND state_hash=? AND expires>? RETURNING verifier,client_id').bind(uid,await digest(state),Date.now()).first<{verifier:string;client_id:string}>();
  if(!row)throw Error('Authorization expired');
  stage='encryption';
  const e=brokerEnv(),verifier=await unseal(row.verifier,e.BROKER_TOKEN_KEY,uid);
  stage='token_exchange';
  const response=await fetch('https://auth.deriv.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:row.client_id,code,code_verifier:verifier,redirect_uri:callbackUrl()}),signal:AbortSignal.timeout(15000)});
  status=response.status;
  if(!response.ok){
   const body:any=await response.json().catch(()=>null);
   // Never log raw responses, codes, tokens, request URLs or provider descriptions.
   if(['invalid_grant','invalid_client','invalid_request','unauthorized_client','invalid_scope','server_error','temporarily_unavailable'].includes(body?.error))providerError=body.error;
   if(providerError==='invalid_grant')stage='expired_code';
   if(providerError==='invalid_client'||providerError==='unauthorized_client')stage='app_registration';
   throw Error('Token exchange failed');
  }
  stage='token_response';
  const token:any=await response.json();
  if(typeof token.access_token!=='string'||token.access_token.length>8192||token.token_type?.toLowerCase()!=='bearer'||!Number.isFinite(token.expires_in)||token.expires_in<=0)throw Error('Invalid token');
  stage='save_connection';status=undefined;
  await db().prepare('INSERT INTO broker_tokens(user_id,ciphertext,expires) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET ciphertext=excluded.ciphertext,expires=excluded.expires').bind(uid,await seal(token.access_token,e.BROKER_TOKEN_KEY,uid),Date.now()+Math.min(token.expires_in,86400)*1000).run();
  result='connected';
 }catch{
  console.error('Deriv connection failed',JSON.stringify({reference,stage,status,providerError}));
 }
 const params=new URLSearchParams({view:'accounts',deriv:result});
 if(result==='failed'){params.set('reason',stage);params.set('ref',reference);}
 return new Response(null,{status:303,headers:{Location:`/?${params}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
