import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE signal_results(id TEXT PRIMARY KEY,user_id TEXT,signal TEXT,status TEXT,started_at INTEGER,cursor INTEGER,result TEXT);CREATE TABLE alert_deliveries(id TEXT PRIMARY KEY,status TEXT);');
globalThis.recoveryDb={
 prepare(query){
  const st=sql.prepare(query);
  return {bind(...args){return {
   async all(){return {results:st.all(...args)}},
   async run(){return {meta:{changes:Number(st.run(...args).changes)}}}
  }}};
 }
};
globalThis.recoveryMessages=[];
const bundle=await build({entryPoints:['lib/alerts.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'mock',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'mock'}));b.onResolve({filter:/^\.\/server$/},()=>({path:'server',namespace:'mock'}));b.onResolve({filter:/^\.\/telegram-delivery$/},()=>({path:'telegram',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},x=>({contents:{env:'export const env={}',auth:'export const getChatGPTUser=async()=>null',server:'export const db=()=>globalThis.recoveryDb;export const readDesk=async()=>{};export const futures=async()=>{throw Error("Unexpected futures fetch")};export const tokenChart=async()=>{};export const trendingTokens=async()=>{}',telegram:'export const deliver=async(id,text)=>{globalThis.recoveryMessages.push({id,text});return "sent"};export const deliverSignal=async()=>{};export const retryTelegram=async()=>{}'}[x.path]}))}}]});
const {trackSignalResults}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
try{const cursor=Math.floor((Date.now()-86400000)/60000)*60,s={market:'Forex',symbol:'frxEURUSD',side:'BUY',entry:100,stop:90,target:120};for(const uid of ['alice','bob']){sql.prepare('INSERT INTO signal_results VALUES(?,?,?,\'pending\',0,?,\'{}\')').run(uid,uid,JSON.stringify(s),cursor);sql.prepare('INSERT INTO alert_deliveries VALUES(?,\'sent\')').run(uid)}let end;
await trackSignalResults('alice',async()=>{throw Error('Recent-only history must not be used')},async(symbol,e)=>{end=e;return [{time:cursor,open:100,high:121,low:99,close:120}]});assert.equal(end,cursor+199*60);const alice=sql.prepare('SELECT * FROM signal_results WHERE id=?').get('alice');assert.equal(alice.status,'target_hit');assert.equal(JSON.parse(alice.result).evidence.time,cursor);assert.equal(sql.prepare('SELECT status FROM signal_results WHERE id=?').get('bob').status,'pending');assert.equal(globalThis.recoveryMessages.length,1);assert.match(globalThis.recoveryMessages[0].text,/TARGET HIT/);console.log('Passed: historical recovery persists evidence, preserves user isolation and prepares only the matching result notification. Telegram is mocked.');
}finally{sql.close();delete globalThis.recoveryDb;delete globalThis.recoveryMessages}
