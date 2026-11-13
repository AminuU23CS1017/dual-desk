import {okxFutures} from './okx-feed';
import {FeedError,retryDelay} from './feed-errors';
import {validTimeframe,aggregateCandles} from './timeframes';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {initialDesk, type Desk} from './desk';
export async function identity(request?:Request){const u=await getChatGPTUser();if(!u)throw Error('Sign in to save your personal trading desk.');if(request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw Error('Request origin rejected.');}return u.userId;}
export function db(){if(!env.DB)throw Error('Saved desk is unavailable. Please try again later.');return env.DB;}
export async function readDesk(id:string){const row=await db().prepare('SELECT data,revision FROM desks WHERE user_id=?').bind(id).first<{data:string;revision:number}>();return row?{desk:JSON.parse(row.data) as Desk,revision:row.revision}:{desk:initialDesk(),revision:-1};}
export async function saveDesk(id:string,desk:Desk,rev:number){const data=JSON.stringify(desk);const r=rev===-1?await db().prepare('INSERT INTO desks(user_id,data,revision) VALUES(?,?,0) ON CONFLICT(user_id) DO NOTHING').bind(id,data).run():await db().prepare('UPDATE desks SET data=?,revision=revision+1 WHERE user_id=? AND revision=?').bind(data,id,rev).run();if(r.meta.changes!==1)throw Error('Your desk changed in another tab. Refresh and try again.');}
export function fail(e:unknown){const m=e instanceof Error?e.message:'Request failed';return Response.json({error:m},{status:m.startsWith('Sign in')?401:400});}
const publicFeedCache=new Map<string,{expires:number,data:any}>();
export async function jsonFetch(url:string){
 const host=new URL(url).hostname,provider=({'www.okx.com':'OKX','api.geckoterminal.com':'GeckoTerminal','api.dexscreener.com':'DEX Screener','api.bybit.com':'Bybit','fapi.binance.com':'Binance'} as Record<string,string>)[host];
 const ttl=host==='api.geckoterminal.com'?(url.includes('/ohlcv/')?30000:300000):0,cached=publicFeedCache.get(url);
 if(ttl&&cached&&cached.expires>Date.now())return cached.data;
 const health=provider?await db().prepare('SELECT retry_at,updated_at,message FROM feed_health WHERE provider=?').bind(provider).first<{retry_at:number;updated_at:number;message:string}>():null;
 if(health&&health.retry_at>Date.now())throw new FeedError(`${health.message} Retry after ${new Date(health.retry_at).toISOString()}.`,'COOLDOWN',health.retry_at-Date.now());
 const r=await fetch(url,{signal:AbortSignal.timeout(10000)});
 if(r.status===429||r.status===403||r.status===451){
  const detail=(r.headers.get('server')??'unspecified').replace(/[^a-zA-Z0-9 ._-]/g,'').slice(0,60),message=`${provider??'Market feed'} request returned HTTP ${r.status} (server: ${detail}). ${r.status===429?'Request limit reached.':'Access or region restrictions may apply.'}`;
  const retry=Math.max(retryDelay(r.headers.get('retry-after')),r.status===429?0:3600000,Math.min(6*3600000,health?2*(health.retry_at-health.updated_at):0));
  if(provider)await db().prepare('INSERT INTO feed_health(provider,retry_at,message,updated_at) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET retry_at=excluded.retry_at,message=excluded.message,updated_at=excluded.updated_at').bind(provider,Date.now()+retry,message,Date.now()).run();
  throw new FeedError(message,String(r.status),retry);
 }
 if(!r.ok)throw Error(`Market feed unavailable (${r.status}).`);
 const data=await r.json();if(provider&&health)await db().prepare('DELETE FROM feed_health WHERE provider=?').bind(provider).run();
 if(ttl){if(publicFeedCache.size>=200)publicFeedCache.delete(publicFeedCache.keys().next().value!);publicFeedCache.set(url,{expires:Date.now()+ttl,data});}return data;
}
export async function futures(venue:string,symbol:string,minutes=15,before?:number){validTimeframe(minutes);if(!['Binance','Bybit','OKX'].includes(venue)||!/^[A-Z0-9]{2,25}USDT$/.test(symbol))throw Error('Unsupported futures market.');
 if(venue==='OKX')return okxFutures(jsonFetch,symbol,minutes,before);
 const raw=venue==='Binance'?await jsonFetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${minutes<60?`${minutes}m`:minutes<1440?`${minutes/60}h`:"1d"}&limit=200${before?`&endTime=${Math.floor(before*1000)}`:""}`):await jsonFetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${minutes===1440?"D":minutes}&limit=200${before?`&end=${Math.floor(before*1000)}`:""}`);
 if(venue==='Bybit'&&raw.retCode!==0)throw Error(raw.retMsg||'Bybit feed unavailable.');
 const rows=venue==='Binance'?raw:raw.result.list.slice().reverse();if(!Array.isArray(rows)||rows.length===0)throw Error('No earlier candle data available.');
 const candles=rows.map((x:any[])=>({time:Number(x[0])/1000,open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4])}));
 const quote=venue==='Binance'?await jsonFetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`):await jsonFetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`);
 if(venue==='Bybit'&&quote.retCode!==0)throw Error('Bybit price unavailable.');
 const price=Number(venue==='Binance'?quote.price:quote.result.list[0].lastPrice);if(!Number.isFinite(price)||price<=0)throw Error('Invalid market quote.');
 return {candles,price,asOf:Date.now(),source:venue};
}
export async function token(address:string){if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))throw Error('Enter a valid Solana token address.');const raw=await jsonFetch(`https://api.dexscreener.com/token-pairs/v1/solana/${address}`);const pairs=(Array.isArray(raw)?raw:[]).filter((p:any)=>p.baseToken?.address===address).sort((a:any,b:any)=>(b.liquidity?.usd??0)-(a.liquidity?.usd??0));const p=pairs[0];if(!p||!Number(p.priceUsd))throw Error('No indexed USD-priced pool found. New pump.fun launches may not be indexed yet.');return {address,poolAddress:p.pairAddress,symbol:p.baseToken.symbol,name:p.baseToken.name,price:Number(p.priceUsd),liquidity:p.liquidity?.usd??null,volume:p.volume?.h24??null,change:p.priceChange?.h24??null,marketCap:p.marketCap??null,buys:p.txns?.h24?.buys??null,sells:p.txns?.h24?.sells??null,url:p.url,asOf:Date.now(),source:'DEX Screener',security:'Holder concentration and mint/freeze permissions are not verified.'};}
export async function tokenChart(address:string,minutes=15){
 validTimeframe(minutes);
 const info=await token(address);let candles:any[]=[];let chartError:string|null=null;let chartPool=info.poolAddress;
 try{
  const pools=await jsonFetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${address}/pools`);
  const matches=(pools.data??[]).filter((p:any)=>p.relationships?.base_token?.data?.id===`solana_${address}`||p.relationships?.quote_token?.data?.id===`solana_${address}`).sort((a:any,b:any)=>Number(b.attributes.reserve_in_usd??0)-Number(a.attributes.reserve_in_usd??0));
  const pool=matches.find((p:any)=>p.attributes.address===info.poolAddress)??matches[0];
  if(!pool||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pool.attributes.address))throw Error('This token does not have an indexed chart pool yet.');
  chartPool=pool.attributes.address;
  const r=await jsonFetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool.attributes.address}/ohlcv/${minutes>=1440?"day":minutes>=60?"hour":"minute"}?aggregate=${minutes>=1440?1:minutes>=60?minutes/60:minutes===30?15:minutes}&limit=200&currency=usd&token=${address}`);
  candles=(r.data?.attributes?.ohlcv_list??[]).map((x:number[])=>({time:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4])})).filter((c:any)=>[c.time,c.open,c.high,c.low,c.close].every(Number.isFinite)&&c.low>0&&c.high>=Math.max(c.open,c.close)&&c.low<=Math.min(c.open,c.close)).sort((a:any,b:any)=>a.time-b.time);
  if(minutes===30)candles=aggregateCandles(candles,1800);
  if(!candles.length)throw Error('Price history is not available for this pool yet.');
 }catch(e){chartError=e instanceof Error?e.message:'Chart feed unavailable.';}
 return {...info,candles,chartError,chartPoolAddress:chartPool,chartSource:'GeckoTerminal',chartFetchedAt:Date.now()};
}
export async function trendingTokens(){const r=await jsonFetch('https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token');const included=r.included??[];const seen=new Set<string>();return {tokens:(r.data??[]).map((p:any)=>included.find((t:any)=>t.id===p.relationships?.base_token?.data?.id)?.attributes).filter((t:any)=>t&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t.address)&&!['SOL','WSOL','USDC','USDT'].includes(t.symbol)&&!seen.has(t.address)&&!!seen.add(t.address)).slice(0,8).map((t:any)=>({address:t.address,symbol:t.symbol,name:t.name})),source:'GeckoTerminal',asOf:Date.now()};}

const catalogs=new Map<string,{expires:number;instruments:{label:string;value:string}[]}>();
export async function futuresInstruments(venue:string){
 if(!['Binance','Bybit','OKX'].includes(venue))throw Error('Unsupported exchange.');
 const cached=catalogs.get(venue);if(cached&&cached.expires>Date.now())return {instruments:cached.instruments,source:venue};
 if(venue==='OKX'){const r=await jsonFetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP');if(r.code!=='0')throw Error('OKX instruments unavailable.');const instruments=(r.data??[]).filter((x:any)=>x.state==='live'&&x.settleCcy==='USDT'&&/^[A-Z0-9]{2,25}-USDT-SWAP$/.test(x.instId)).map((x:any)=>({label:x.instId.split('-')[0]+' / USDT',value:x.instId.replace('-USDT-SWAP','USDT')}));if(!instruments.length)throw Error('No active OKX instruments.');catalogs.set(venue,{expires:Date.now()+300000,instruments});return {instruments,source:venue};}
 let list:any[]=[];
 if(venue==='Binance'){const r=await jsonFetch('https://fapi.binance.com/fapi/v1/exchangeInfo');list=(r.symbols??[]).filter((s:any)=>s.status==='TRADING'&&s.contractType==='PERPETUAL'&&s.quoteAsset==='USDT');}
 else {let cursor='';for(let page=0;page<5;page++){const r=await jsonFetch(`https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`);if(r.retCode!==0)throw Error(r.retMsg||'Instrument list unavailable.');list.push(...(r.result?.list??[]).filter((s:any)=>s.status==='Trading'&&s.contractType==='LinearPerpetual'&&s.quoteCoin==='USDT'));cursor=r.result?.nextPageCursor??'';if(!cursor)break;}}
 const instruments=list.filter(s=>/^[A-Z0-9]{2,25}USDT$/.test(s.symbol)).map(s=>({label:`${s.baseAsset??s.baseCoin} / USDT`,value:s.symbol})).sort((a,b)=>a.label.localeCompare(b.label));
 if(!instruments.length)throw Error('No active USDT perpetual futures returned.');catalogs.set(venue,{expires:Date.now()+300000,instruments});return {instruments,source:venue};
}
export async function searchTokens(q:string){
 if(q.length<2||q.length>100)throw Error('Enter a coin name or symbol (2–100 characters).');
 const r=await jsonFetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);const seen=new Set<string>();
 return {tokens:(r.pairs??[]).filter((p:any)=>p.chainId==='solana'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.baseToken?.address)).sort((a:any,b:any)=>(b.liquidity?.usd??0)-(a.liquidity?.usd??0)).filter((p:any)=>!seen.has(p.baseToken.address)&&!!seen.add(p.baseToken.address)).slice(0,12).map((p:any)=>({address:p.baseToken.address,symbol:p.baseToken.symbol,name:p.baseToken.name,liquidity:p.liquidity?.usd??null})),source:'DEX Screener'};
}

export async function tokenHistory(address:string,pool:string,minutes:number,before:number){validTimeframe(minutes);if(![address,pool].every(a=>/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)))throw Error('Invalid token or pool address.');const unit=minutes>=1440?'day':minutes>=60?'hour':'minute',aggregate=minutes>=1440?1:minutes>=60?minutes/60:minutes===30?15:minutes;const r=await jsonFetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/${unit}?aggregate=${aggregate}&before_timestamp=${Math.floor(before)}&limit=200&currency=usd&token=${address}`);let candles=(r.data?.attributes?.ohlcv_list??[]).map((x:number[])=>({time:Number(x[0]),open:Number(x[1]),high:Number(x[2]),low:Number(x[3]),close:Number(x[4])})).filter((c:any)=>[c.time,c.open,c.high,c.low,c.close].every(Number.isFinite)&&c.low>0&&c.high>=Math.max(c.open,c.close)&&c.low<=Math.min(c.open,c.close)).sort((a:any,b:any)=>a.time-b.time);if(minutes===30){const first=candles[0]?.time;candles=aggregateCandles(candles,1800);if(first%1800!==0)candles.shift();}return {candles};}
