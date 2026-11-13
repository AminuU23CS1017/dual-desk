import {telegramResult} from './telegram-response';
import {env} from 'cloudflare:workers';
import {db} from './server';
import type {Signal,Trade} from './desk';
let nextTelegramSend=0;
export async function deliver(id:string,text:string){
 const e=env as unknown as Record<string,string>;
 if(!e.TELEGRAM_BOT_TOKEN||!e.TELEGRAM_CHAT_ID)return 'not_configured';
 let claim=await db().prepare('INSERT INTO alert_deliveries(id,created_at,status,payload,attempts) VALUES(?,?,?,?,1) ON CONFLICT(id) DO NOTHING').bind(id,Date.now(),'pending',text).run();
 if(!claim.meta.changes){claim=await db().prepare("UPDATE alert_deliveries SET status='pending',created_at=?,attempts=attempts+1 WHERE id=? AND status='retry_wait' AND retry_at<=? AND attempts<3").bind(Date.now(),id,Date.now()).run();if(!claim.meta.changes){const row=await db().prepare('SELECT status FROM alert_deliveries WHERE id=?').bind(id).first<{status:string}>();return row?.status??'pending'}}
 const row=await db().prepare('SELECT attempts FROM alert_deliveries WHERE id=?').bind(id).first<{attempts:number}>();
 let outcome:{status:string;retryAt:number;errorCode:string|null}={status:'uncertain',retryAt:0,errorCode:'NO_CONFIRMATION'};
 const delay=Math.max(0,nextTelegramSend-Date.now());nextTelegramSend=Date.now()+delay+1100;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
 try{const r=await fetch(`https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:e.TELEGRAM_CHAT_ID,text}),signal:AbortSignal.timeout(10000)});const data:any=await r.json();outcome=telegramResult(r.status,data,row?.attempts??1)}catch{}
 await db().prepare('UPDATE alert_deliveries SET status=?,retry_at=?,error_code=? WHERE id=?').bind(outcome.status,outcome.retryAt,outcome.errorCode,id).run();return outcome.status;
}
export async function retryTelegram(uid:string){
 const prefixes=[`signal:${uid}:`,`outcome:signal:${uid}:`,`paper-result:${uid}:`];
 await db().prepare("UPDATE alert_deliveries SET status='uncertain',error_code='NO_CONFIRMATION' WHERE status='pending' AND created_at<? AND (instr(id,?)=1 OR instr(id,?)=1 OR instr(id,?)=1)").bind(Date.now()-120000,...prefixes).run();
 const rows=await db().prepare("SELECT id,payload FROM alert_deliveries WHERE status='retry_wait' AND retry_at<=? AND (instr(id,?)=1 OR instr(id,?)=1 OR instr(id,?)=1) ORDER BY created_at LIMIT 4").bind(Date.now(),...prefixes).all<{id:string;payload:string}>();
 for(const row of rows.results){const tracked=await db().prepare('SELECT signal FROM signal_results WHERE id=?').bind(row.id).first<{signal:string}>();if(tracked){const s=JSON.parse(tracked.signal);if(Date.now()-s.time>Math.min(2*(s.timeframe??15),1440)*60000){await db().prepare("UPDATE alert_deliveries SET status='expired' WHERE id=? AND status='retry_wait'").bind(row.id).run();continue;}}
  const status=await deliver(row.id,row.payload);if(tracked&&status==='sent'){const now=Date.now();await db().prepare("UPDATE signal_results SET started_at=?,cursor=? WHERE id=? AND status='pending'").bind(now,Math.ceil(now/60000)*60,row.id).run();}
 }
}
export async function alertsEnabled(){const r=await db().prepare("SELECT enabled FROM alert_config WHERE id='telegram'").first<{enabled:number}>();return r?.enabled!==0}
export async function deliverSignal(uid:string,s:Signal,watch=false){
 const id=`signal:${uid}:${s.id}`,started=Date.now(),cursor=Math.ceil(started/60000)*60;
 await db().prepare("INSERT INTO signal_results(id,user_id,signal,status,started_at,cursor,result) VALUES(?,?,?,'pending',?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,uid,JSON.stringify(s),started,cursor,'{}').run();
 const text=`Dual Desk · ${watch||s.market==='Memecoins'?'WATCHLIST ONLY — token safety unverified':'PRACTICE SIGNAL'}\n${s.market} · ${s.symbol}\n${s.side} · ${s.timeframe??15}m\nReference ${s.entry}\nStop ${s.stop} · Target ${s.target}\n${s.reason}\nResults track price levels from the next full minute, not an executed broker trade. No guaranteed outcome.\nView chart and analysis (sign in to the sending workspace): https://dual-desk-trading.ayomideaminu.chatgpt.site/?view=results&signal=${encodeURIComponent(s.id)}`;
 const prior=await db().prepare('SELECT status FROM alert_deliveries WHERE id=?').bind(id).first();const status=await deliver(id,text);return {status,id,duplicate:!!prior};
}
export async function deliverPaperResult(uid:string,t:Trade){return deliver(`paper-result:${uid}:${t.id}`,`Dual Desk · PRACTICE TRADE CLOSED\n${t.symbol} · ${t.side}\n${(t.pnl??0)>0?'Profit':(t.pnl??0)<0?'Loss':'Break-even'}: ${(t.pnl??0).toFixed(2)} simulated USD (fees included)\nEntry ${t.entry} · Exit ${t.exit}\nSimulated result, not broker profit.`)}
