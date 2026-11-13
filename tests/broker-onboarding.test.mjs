import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {seal} from '../lib/broker-security.ts';
const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE broker_configs(user_id TEXT PRIMARY KEY,client_id TEXT);CREATE TABLE broker_tokens(user_id TEXT PRIMARY KEY,ciphertext TEXT,expires INTEGER);CREATE TABLE broker_oauth(user_id TEXT PRIMARY KEY,state_hash TEXT,verifier TEXT,client_id TEXT,expires INTEGER);');
globalThis.onboardDb={prepare(sql){const st=sqlite.prepare(sql);return {bind(...args){return {async first(){return st.get(...args)??null},async run(){return {meta:{changes:Number(st.run(...args).changes)}}},async all(){return {results:st.all(...args)}}}}}},async batch(items){return Promise.all(items.map(x=>x.run()))}};
const key='b'.repeat(64);for(const uid of ['alice','bob'])sqlite.prepare('INSERT INTO broker_tokens VALUES(?,?,?)').run(uid,await seal('test-token-'+uid,key,uid),Date.now()+3600000);
const bundled=await build({entryPoints:['app/api/broker/deriv/route.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'test-boundaries',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'mock'}));b.onResolve({filter:/(^|\/)server$/},()=>({path:'db',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},x=>({contents:x.path==='env'?`export const env={BROKER_SITE_ORIGIN:'https://desk.test',BROKER_TOKEN_KEY:'${key}',TELEGRAM_ALLOWED_EMAILS:'owner@example.test'}`:x.path==='auth'?'export const getChatGPTUser=async()=>globalThis.onboardUser':'export const db=()=>globalThis.onboardDb'}))}}]});
const route=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));const original=globalThis.fetch;let calls=0;
globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.derivws.com/trading/v1/options/accounts');const uid=options.headers.Authorization.endsWith('alice')?'alice':'bob';return Response.json({data:[{account_id:uid+'_demo',account_type:'demo',status:'active',balance:1000,currency:'USD'}]})};
const post=(body,origin='https://desk.test')=>new Request('https://desk.test/api/broker/deriv',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
try{
 globalThis.onboardUser={userId:'alice',email:'alice@example.test'};const a=await (await route.GET()).json();assert.equal(a.accounts[0].id,'alice_demo');
 globalThis.onboardUser={userId:'bob',email:'bob@example.test'};const b=await (await route.GET()).json();assert.equal(b.accounts[0].id,'bob_demo');assert(!JSON.stringify(b).includes('alice'));assert(!JSON.stringify(b).includes('test-token'));
 const before=calls;assert.equal((await route.POST(post({action:'demo-session',accountId:'alice_demo'}))).status,400);assert.equal(calls,before+1,'Foreign account must fail before requesting a session');
 assert.equal((await route.POST(post({action:'connect'},'https://evil.test'))).status,400);
 globalThis.onboardUser=null;assert.equal((await route.GET()).status,400);assert.equal((await route.POST(post({action:'connect'}))).status,400);
 console.log('Passed: non-owner onboarding, per-user encrypted account isolation, no token disclosure, foreign demo-session rejection, CSRF and signed-out denial.');
}finally{globalThis.fetch=original;delete globalThis.onboardUser;delete globalThis.onboardDb;sqlite.close()}
