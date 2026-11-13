import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE feed_health(provider TEXT PRIMARY KEY,retry_at INTEGER,message TEXT,updated_at INTEGER);');
globalThis.feedTestDb={
 prepare(sql){
  const st=sqlite.prepare(sql);
  return {bind(...args){return {
   async first(){return st.get(...args)??null},
   async run(){return {meta:{changes:Number(st.run(...args).changes)}}}
  }}};
 }
};
const result=await build({entryPoints:['lib/server.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'boundaries',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},x=>({contents:x.path==='env'?'export const env={DB:globalThis.feedTestDb}':'export const getChatGPTUser=async()=>null'}))}}]});
const {jsonFetch}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));const original=fetch;let calls=0,mode='rate';globalThis.fetch=async()=>{calls++;return mode==='rate'?new Response('{}',{status:429,headers:{'retry-after':'3600',server:'test-gateway'}}):Response.json({ok:true})};
try{await assert.rejects(jsonFetch('https://www.okx.com/test'),/HTTP 429/);const h=sqlite.prepare('SELECT * FROM feed_health WHERE provider=?').get('OKX');assert(h.retry_at-Date.now()>3500000);await assert.rejects(jsonFetch('https://www.okx.com/other'),/Retry after/);assert.equal(calls,1);mode='ok';await jsonFetch('https://api.bybit.com/test');assert.equal(calls,2);sqlite.prepare('UPDATE feed_health SET retry_at=0').run();await jsonFetch('https://www.okx.com/test');assert.equal(calls,3);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM feed_health').get().n,0);console.log('Passed persisted provider cooldown, Retry-After respect, no requests during cooldown, separate provider budgets and recovery clearing.');}finally{globalThis.fetch=original;delete globalThis.feedTestDb;sqlite.close()}
