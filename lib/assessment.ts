import {analyse,indicators,type Candle,type Signal} from './desk';
export type Assessment={label:string;tone:'green'|'amber'|'red';summary:string;reasons:string[];signal:Signal|null};
export function assess(c:Candle[],market:string,symbol:string,quote:number|null,quoteAt:number,token:any=null,now=Date.now(),minutes=15):Assessment{
 const wait=(summary:string,reasons:string[]=[],label='Not enough data'):Assessment=>({label,tone:'amber',summary,reasons,signal:null});
 if(!quote||!Number.isFinite(quote)||!quoteAt||now-quoteAt>120000)return wait('Refresh the price before making a decision. Old or missing prices cannot support an entry.');
 const closed=c.filter(b=>b.time*1000+minutes*60000<=now);
 if(closed.length<60)return wait(`We need at least 60 completed ${minutes}-minute candles to check the trend and entry rules.`);
 if(now-closed.at(-1)!.time*1000>2*minutes*60000)return wait('The chart has stopped updating. Wait for fresh candles.');
 const k=indicators(closed),rising=k.ema20>k.ema50,s=analyse(c,market,symbol,minutes,now);
 const reasons=[`EMA 20/50 trend: ${rising?'rising':'falling'}.`,`Trend strength ADX: ${k.adx.toFixed(1)} (minimum 20). Momentum RSI: ${k.rsi.toFixed(1)}.`,s?'A completed candle broke the prior 20-candle range and passed the filters.':'Waiting for trend, momentum and a completed range breakout to agree.'];
 if(s&&Math.abs(quote-s.entry)>k.atr*.5)return wait('Price has moved too far from the breakout entry. Wait for a fresh setup.',reasons,'Wait · avoid chasing');
 if(market==='Memecoins'){
  if(token?.liquidity==null||token?.liquidity<100000)return {label:'Avoid buying for now',tone:'red',summary:'Pool liquidity is missing or below our $100,000 research filter. Buying or selling may move the price sharply.',reasons:[...reasons,'Liquidity is a screening rule, not a guarantee of safety.'],signal:null};
  if(s?.side==='SELL'||!rising)return {label:'Avoid buying for now',tone:'red',summary:'The price trend is weak. This is not a spot-buy setup.',reasons:[...reasons,'Token holder concentration and mint/freeze permissions remain unverified.'],signal:null};
  return {label:'Wait · token checks incomplete',tone:'amber',summary:s?.side==='BUY'?'The chart matches our buy rule, but token safety checks are incomplete. Keep it on your watchlist.':'The trend is rising, but there is no confirmed buy entry yet.',reasons:[...reasons,`Pool liquidity: $${Math.round(token.liquidity).toLocaleString('en-US')}.`,'Holder concentration and mint/freeze permissions are not verified.'],signal:null};
 }
 if(s?.side==='BUY'){
  if(quote<=s.stop||quote>=s.target)return wait('The price has already passed the planned stop or target. Wait for a new setup.',reasons,'Wait · entry has passed');
  return {label:'Buy setup · practice first',tone:'green',summary:'The trend and breakout rules agree on a buy entry. This is a rule-based setup, not a proven profitable prediction.',reasons,signal:s};
 }
 if(s?.side==='SELL'&&(quote>=s.stop||quote<=s.target))return wait('The price has already passed the planned stop or target. Wait for a new setup.',reasons,'Wait · entry has passed');
 if(s?.side==='SELL')return {label:'Avoid buying now',tone:'red',summary:'The rules currently favor a falling price. An optional sell setup is available for practice.',reasons,signal:s};
 return wait(rising?'The price trend is rising, but our buy-entry rule has not triggered.':'The price trend is weak and there is no confirmed buy setup.',reasons,'Wait for a clearer entry');
}
