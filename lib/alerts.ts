import {FeedError} from './feed-errors';
import {openDerivFeed,type DerivSnapshot} from './deriv-feed';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {telegramAllowed} from './telegram-auth';
import {db,readDesk,futures,tokenChart,trendingTokens} from './server';
import {assess} from './assessment';
import {analyse,type Candle} from './desk';
import {deliver,deliverSignal,retryTelegram} from './telegram-delivery';
import {evaluateSignal,outcomeHistoryEnd,type Outcome} from './signal-outcomes';
import {timeframeLabel} from './timeframes';
export async function alertUser(){const u=await getChatGPTUser();if(!u)throw Error('Sign in to manage alerts.');if(!telegramAllowed(u,env as unknown as Record<string,string>))throw Error('This account is not approved for Telegram alerts.');return u;}
const defaults=[['Forex','frxEURUSD'],['Forex','frxGBPUSD'],['Forex','frxUSDJPY'],['Synthetics','R_10'],['Synthetics','R_25'],['Synthetics','R_50'],['Synthetics','R_75'],['Synthetics','R_100'],['Synthetics','BOOM500'],['Synthetics','CRASH500'],['Synthetics','BOOM1000'],['Synthetics','CRASH1000'],['Futures','OKX:BTCUSDT'],['Futures','OKX:ETHUSDT']];
export async function alertStatus(){const config=await db().prepare("SELECT enabled FROM alert_config WHERE id='telegram'").first<{enabled:number}>();const last=await db().prepare('SELECT created_at,result FROM alert_runs ORDER BY created_at DESC LIMIT 1').first<{created_at:number;result:string}>();const health=await db().prepare('SELECT provider,retry_at,message,updated_at FROM feed_health').all();return {health:health.results,enabled:config?.enabled!==0,timeframes:['15m','1h'],instruments:defaults.map(x=>x[1]),memecoins:'First two saved Solana tokens, or two trending Solana tokens when the watchlist is empty. Watchlist alerts only.',lastScan:last?.created_at??null,lastResult:last?JSON.parse(last.result):null};}
export async function toggleAlerts(enabled:boolean){await db().prepare("INSERT INTO alert_config(id,enabled) VALUES('telegram',?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled").bind(enabled?1:0).run();return alertStatus();}
export async function derivSnapshot(symbol:string,minutes:number){const feed=await openDerivFeed();try{return await feed.snapshot(symbol,minutes)}finally{feed.close()}}
export async function scanAlerts(userId:string){
 const e=env as unknown as Record<string,string>;if(!e.TELEGRAM_BOT_TOKEN||!e.TELEGRAM_CHAT_ID)throw Error('Telegram is not configured.');
 const status=await alertStatus();if(!status.enabled)return {paused:true};
 const now=Date.now(),runId=userId+':'+String(Math.floor(now/300000));const lock=await db().prepare('INSERT INTO alert_runs(id,created_at,result) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(runId,now,JSON.stringify({state:'running'})).run();if(!lock.meta.changes)return {alreadyScanned:true,...await alertStatus()};
 const cooldowns=await db().prepare('SELECT provider,retry_at,message FROM feed_health WHERE retry_at>?').bind(now).all<{provider:string;retry_at:number;message:string}>();const cooldown=new Map(cooldowns.results.map(r=>[r.provider,r]));
 async function cool(provider:string,error:unknown){if(error instanceof FeedError&&error.retryAfter){if(cooldown.has(provider))return;const prior=await db().prepare('SELECT retry_at,updated_at FROM feed_health WHERE provider=?').bind(provider).first<{retry_at:number;updated_at:number}>();const priorDelay=prior?Math.max(0,prior.retry_at-prior.updated_at):0;const delay=Math.max(error.retryAfter,Math.min(6*3600000,priorDelay*2));const retryAt=Date.now()+delay;cooldown.set(provider,{provider,retry_at:retryAt,message:error.message});await db().prepare('INSERT INTO feed_health(provider,retry_at,message,updated_at) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET retry_at=excluded.retry_at,message=excluded.message,updated_at=excluded.updated_at').bind(provider,retryAt,error.message,Date.now()).run();}}
 let derivFeed:ReturnType<typeof openDerivFeed>|undefined;const readDeriv=async(symbol:string,minutes:number)=>{const c=cooldown.get('Deriv');if(c)throw Error(c.message+' Retry after '+new Date(c.retry_at).toISOString());try{const snapshot=await (await (derivFeed??=openDerivFeed())).snapshot(symbol,minutes);await db().prepare('DELETE FROM feed_health WHERE provider=?').bind('Deriv').run();return snapshot}catch(e){await cool('Deriv',e);throw e}};
 const readDerivHistory=async(symbol:string,end:number)=>{const c=cooldown.get('Deriv');if(c)throw Error(c.message+' Retry after '+new Date(c.retry_at).toISOString());try{const candles=await (await (derivFeed??=openDerivFeed())).history(symbol,end);if(!candles.length)throw Error('Outcome history unavailable.');await db().prepare('DELETE FROM feed_health WHERE provider=?').bind('Deriv').run();return candles}catch(e){await cool('Deriv',e);throw e}};
 const result={state:'complete',checked:0,sent:0,duplicates:0,errors:[] as string[],skipped:0,savedTokenCount:0,tokenMode:'saved',monitoredTokens:[] as {address:string;symbol:string}[],futuresProvider:'OKX',markets:Object.fromEntries(['Forex','Synthetics','Futures','Memecoins'].map(m=>[m,{checked:0,qualified:0,sent:0,errors:0}]))};
 try{
 await retryTelegram(userId);const {desk}=await readDesk(userId);result.savedTokenCount=desk.tokens.length;let tokens=desk.tokens.slice(0,2).map(address=>({address,symbol:address}));if(!tokens.length){result.tokenMode='trending';try{tokens=(await trendingTokens()).tokens.slice(0,2);if(!tokens.length)throw Error('No trending Solana tokens returned.');}catch(err){result.markets.Memecoins.errors++;result.errors.push('Trending tokens: '+(err instanceof Error?err.message:'Discovery unavailable'));}}result.monitoredTokens=tokens;const instruments=[...defaults,...tokens.map(t=>['Memecoins',t.address])];const jobs=instruments.flatMap(([market,symbol])=>[15,60].map(minutes=>({market,symbol,minutes})));
 const candidates:{signal:import('./desk').Signal;watch:boolean}[]=[];
 for(let i=0;i<jobs.length;i+=3){await Promise.all(jobs.slice(i,i+3).map(async({market,symbol,minutes})=>{try{
 const d=market==='Futures'?await futures(symbol.split(':')[0],symbol.split(':')[1],minutes):market==='Memecoins'?await tokenChart(symbol,minutes):await readDeriv(symbol,minutes);if(!d.candles?.length||('chartError' in d&&d.chartError))throw Error(('chartError' in d&&String(d.chartError))||'Analysis candles unavailable.');result.checked++;result.markets[market].checked++;
 const a=assess(d.candles,market,symbol,d.price,d.asOf,market==='Memecoins'?d:null,Date.now(),minutes);let s=a.signal,watch=false;
 if(market==='Memecoins'&&a.label==='Wait · token checks incomplete'){s=analyse(d.candles,market,symbol,minutes);watch=!!s&&s.side==='BUY';if(!watch)s=null;}
 if(!s){result.skipped++;return;}
 candidates.push({signal:s,watch});result.markets[market].qualified++;
 }catch(err){result.markets[market].errors++;result.errors.push(`${symbol} ${timeframeLabel(minutes)}: ${err instanceof Error?err.message:'Feed unavailable'}`)}}));}
 // Give each market a turn so synthetic setups cannot crowd out memecoins.
 const queues=['Forex','Synthetics','Futures','Memecoins'].map(m=>candidates.filter(c=>c.signal.market===m));const fair:typeof candidates=[];while(fair.length<8&&queues.some(q=>q.length))for(const q of queues){const c=q.shift();if(c&&fair.length<8)fair.push(c)}
 for(const candidate of fair){
 const delivery=await deliverSignal(userId,candidate.signal,candidate.watch);
 if(delivery.duplicate)result.duplicates++;else if(delivery.status==='sent'){result.sent++;result.markets[candidate.signal.market].sent++;}else result.errors.push(`Telegram delivery ${delivery.status}. Check delivery status under Profit & loss.`);
 }
 const tracked=await trackSignalResults(userId,readDeriv,readDerivHistory);result.errors.push(...tracked.errors);

 }catch(err){result.state='failed';result.errors.push(err instanceof Error?err.message:'Scan failed.');}
 if(result.state==='complete'&&result.errors.length)result.state=result.checked?'partial':'failed';
 if(derivFeed)await derivFeed.then(f=>f.close()).catch(()=>{});
 await db().prepare('UPDATE alert_runs SET result=? WHERE id=?').bind(JSON.stringify(result),runId).run();return result;
}

export async function trackSignalResults(uid:string,readDeriv:(symbol:string,minutes:number)=>Promise<DerivSnapshot>=derivSnapshot,readHistory?:(symbol:string,end:number)=>Promise<Candle[]>){
 const rows=await db().prepare("SELECT s.id,s.signal,s.cursor FROM signal_results s JOIN alert_deliveries d ON d.id=s.id WHERE s.user_id=? AND s.status='pending' AND d.status='sent' ORDER BY s.started_at LIMIT 40").bind(uid).all<{id:string;signal:string;cursor:number}>();
 const errors:string[]=[];const cache=new Map<string,Promise<any>>();
 for(const row of rows.results){try{
  const s=JSON.parse(row.signal),historical=!!readHistory&&['Forex','Synthetics'].includes(s.market),end=historical?outcomeHistoryEnd(row.cursor):0,key=s.market+':'+s.symbol+':'+end;
  if(!cache.has(key))cache.set(key,historical?readHistory!(s.symbol,end).then(candles=>({candles})):s.market==='Futures'?futures(s.symbol.split(':')[0],s.symbol.split(':')[1],1):s.market==='Memecoins'?tokenChart(s.symbol,1):readDeriv(s.symbol,1));
  const d=await cache.get(key);if(!d.candles?.length)throw Error('Outcome candles unavailable');
  const outcome=evaluateSignal(s,row.cursor,d.candles);
  await db().prepare("UPDATE signal_results SET status=?,cursor=?,result=? WHERE id=? AND status='pending' AND cursor=?").bind(outcome.status,outcome.cursor,JSON.stringify({...outcome,checkedAt:Date.now()}),row.id,row.cursor).run();

 }catch(e){errors.push(`Result ${JSON.parse(row.signal).symbol}: ${e instanceof Error?e.message:'Feed unavailable'}`)}}
 const finished=await db().prepare("SELECT s.id,s.signal,s.result FROM signal_results s JOIN alert_deliveries d ON d.id=s.id LEFT JOIN alert_deliveries o ON o.id='outcome:'||s.id WHERE s.user_id=? AND s.status!='pending' AND d.status='sent' AND o.id IS NULL ORDER BY s.started_at LIMIT 40").bind(uid).all<any>();
 for(const row of finished.results){const status=await deliver('outcome:'+row.id,outcomeMessage(JSON.parse(row.signal),JSON.parse(row.result)));if(status!=='sent')errors.push(`Outcome notification ${status}.`)}
 return {errors};
}
function outcomeMessage(s:any,o:Outcome){const label={target_hit:'TARGET HIT',stop_hit:'STOP HIT',ambiguous:'UNRESOLVED: stop and target in the same candle',data_gap:'UNRESOLVED: missing price history',pending:'PENDING'}[o.status];return `Dual Desk · SIGNAL RESULT\n${s.symbol} · ${s.side}\n${label}\n${o.returnPct===undefined?'No reliable win/loss assigned.':`Reference return ${o.returnPct.toFixed(2)}% · ${o.rMultiple?.toFixed(2)}R before costs`}\nPrice-level observation from complete 1-minute candles after tracking began. Not an executed trade or broker P&L.`}
