import type {Candle} from './desk';
export async function okxFutures(get:(url:string)=>Promise<any>,symbol:string,minutes:number,before?:number){
 if(!/^[A-Z0-9]{2,25}USDT$/.test(symbol))throw Error('Unsupported OKX instrument.');
 const instId=symbol.slice(0,-4)+'-USDT-SWAP',bar=minutes===1440?'1Dutc':minutes>=60?`${minutes/60}H`:`${minutes}m`;
 const data=await get(`https://www.okx.com/api/v5/market/${before?'history-candles':'candles'}?instId=${instId}&bar=${bar}&limit=200${before?`&after=${Math.floor(before*1000)}`:''}`);
 if(data.code!=='0'||!Array.isArray(data.data))throw Error('OKX candle feed unavailable.');
 const candles:Candle[]=data.data.map((r:any[])=>({time:Number(r[0])/1000,open:Number(r[1]),high:Number(r[2]),low:Number(r[3]),close:Number(r[4])})).sort((a:Candle,b:Candle)=>a.time-b.time);
 if(!candles.length||candles.some((c,i)=>![c.time,c.open,c.high,c.low,c.close].every(Number.isFinite)||c.low<=0||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||(i>0&&c.time<=candles[i-1].time)))throw Error('Invalid OKX candle data.');
 const ticker=await get(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`),price=Number(ticker.data?.[0]?.last),asOf=Number(ticker.data?.[0]?.ts);
 if(ticker.code!=='0'||!Number.isFinite(price)||price<=0||!Number.isFinite(asOf)||asOf<=0||asOf>Date.now()+5000||Date.now()-asOf>120000)throw Error('OKX quote is missing or stale.');
 return {candles,price,asOf,source:'OKX'};
}
