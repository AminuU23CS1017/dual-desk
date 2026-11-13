import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE desks(user_id TEXT PRIMARY KEY,data TEXT,revision INTEGER);');
globalThis.walletTestDb={prepare(sql){const st=sqlite.prepare(sql);return {bind(...args){return {async first(){return st.get(...args)??null},async run(){return {meta:{changes:Number(st.run(...args).changes)}}},async all(){return {results:st.all(...args)}}}}}}};
async function bundle(path){const out=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'boundaries',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onResolve({filter:/chatgpt-auth$/},()=>({path:'auth',namespace:'mock'}));b.onResolve({filter:/\/alerts$/},()=>({path:'alerts',namespace:'mock'}));b.onResolve({filter:/\/telegram-delivery$/},()=>({path:'telegram',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},x=>({contents:{env:'export const env={DB:globalThis.walletTestDb}',auth:'export const getChatGPTUser=async()=>globalThis.walletTestUser',alerts:'export const alertUser=async()=>{throw Error("not approved")}',telegram:'export const alertsEnabled=async()=>false;export const deliverSignal=async()=>{};export const deliverPaperResult=async()=>{}'}[x.path]}))}}]});return import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'))}
const wallets=await bundle('app/api/wallets/route.ts'),deskApi=await bundle('app/api/desk/route.ts');
const post=(body,origin='https://desk.test')=>new Request('https://desk.test/api/wallets',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const input={label:'My wallet',provider:'MetaMask',network:'EVM',chainId:'0x1',address:'0x'+'ab'.repeat(20)};
const user=id=>globalThis.walletTestUser={userId:id,email:id+'@test.invalid'};
try{
 user('alice');let r=await wallets.POST(post({action:'save',wallet:input}));assert.equal(r.status,200);const id=(await r.json()).wallets[0].id;
 r=await wallets.POST(post({action:'save',wallet:{...input,address:input.address.toUpperCase().replace('0X','0x'),label:'Renamed'}}));assert.equal(r.status,200);assert.equal((await r.json()).wallets.length,1);
 assert.equal((await wallets.POST(post({action:'save',wallet:{...input,privateKey:'never-store'}}))).status,400);
 assert.equal((await wallets.POST(post({action:'save',wallet:{...input,address:'secret phrase words'}}))).status,400);
 assert.equal((await wallets.POST(post({action:'save',wallet:input},'https://foreign.test'))).status,400);
 user('bob');assert.deepEqual((await (await wallets.GET()).json()).wallets,[]);assert.equal((await wallets.POST(post({action:'remove',id}))).status,400);
 user('alice');const trade={id:'test',market:'Forex',symbol:'frxEURUSD',side:'BUY',entry:100,stop:95,target:110,time:Date.now(),reason:'Test simulation',qty:2,fee:.2,notional:200,risk:10,status:'open'};
 let row=sqlite.prepare('SELECT data FROM desks WHERE user_id=?').get('alice');const desk=JSON.parse(row.data);desk.trades=[trade];sqlite.prepare('UPDATE desks SET data=? WHERE user_id=?').run(JSON.stringify(desk),'alice');
 assert.equal((await deskApi.POST(post({action:'close',id:'test',price:110,quoteAt:Date.now()-300000}))).status,400);
 assert.equal((await deskApi.POST(post({action:'close',id:'test',price:101,quoteAt:Date.now(),automatic:true}))).status,400);
 user('bob');assert.equal((await deskApi.POST(post({action:'close',id:'test',price:110,quoteAt:Date.now()}))).status,400);
 user('alice');r=await deskApi.POST(post({action:'close',id:'test',price:111,quoteAt:Date.now()}));assert.equal(r.status,200);const closed=(await r.json()).desk;assert.equal(closed.trades[0].status,'closed');assert.equal(closed.trades[0].exit,111);assert.equal(closed.trades[0].closeReason,'manual');assert(Math.abs(closed.trades[0].pnl-21.578)<1e-8);assert.equal(closed.wallets[0].id,id);
 assert.equal((await deskApi.POST(post({action:'close',id:'test',price:111,quoteAt:Date.now()}))).status,400);
 const before=JSON.parse(sqlite.prepare('SELECT data FROM desks WHERE user_id=?').get('alice').data).balance;assert.equal(before,closed.balance);
 globalThis.walletTestUser=null;assert.equal((await wallets.GET()).status,401);assert.equal((await wallets.POST(post({action:'save',wallet:input}))).status,401);
 console.log('Passed: wallet isolation, normalization, duplicate prevention, secret-field rejection, CSRF; practice close ownership, stale-price rejection, fee math and duplicate-close protection. No broker trades or wallet requests made.');
}finally{delete globalThis.walletTestDb;delete globalThis.walletTestUser;sqlite.close()}
