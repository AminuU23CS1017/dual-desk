import type {SavedWallet} from './wallets';
export type Candle = {time:number;open:number;high:number;low:number;close:number};
export type Signal = {id:string;market:string;symbol:string;side:'BUY'|'SELL';entry:number;stop:number;target:number;time:number;reason:string;timeframe?:number};
export type Trade = Signal & {qty:number;notional:number;risk:number;fee:number;status:'open'|'closed';exit?:number;pnl?:number;closedAt?:number;closeReason?:'manual'|'stop'|'target'};
export type Desk = {balance:number;settings:{risk:number;daily:number;maxPositions:number;leverage:number;paused:boolean;autoPaper:boolean};trades:Trade[];signals:Signal[];tokens:string[];wallets?:SavedWallet[]};
export const initialDesk = ():Desk => ({balance:10000,settings:{risk:0.5,daily:3,maxPositions:3,leverage:2,paused:false,autoPaper:false},trades:[],signals:[],tokens:[]});
export function indicators(closed:Candle[]){
 const ema=(period:number)=>{let e=closed[0].close;for(const b of closed.slice(1))e+=2/(period+1)*(b.close-e);return e};
 let tr=0,plus=0,minus=0,gain=0,loss=0,adx=0,dxs:number[]=[];
 for(let i=1;i<closed.length;i++){const b=closed[i],p=closed[i-1],up=b.high-p.high,down=p.low-b.low,change=b.close-p.close;
  const t=Math.max(b.high-b.low,Math.abs(b.high-p.close),Math.abs(b.low-p.close)),pd=up>down&&up>0?up:0,md=down>up&&down>0?down:0;
  if(i<=14){tr+=t;plus+=pd;minus+=md;gain+=Math.max(0,change);loss+=Math.max(0,-change)}else{tr=tr-tr/14+t;plus=plus-plus/14+pd;minus=minus-minus/14+md;gain=gain-gain/14+Math.max(0,change);loss=loss-loss/14+Math.max(0,-change)}
  if(i>=14){const dx=plus+minus?100*Math.abs(plus-minus)/(plus+minus):0;dxs.push(dx);if(dxs.length===14)adx=dxs.reduce((a,b)=>a+b,0)/14;else if(dxs.length>14)adx=(adx*13+dx)/14;}
 }
 return {ema20:ema(20),ema50:ema(50),atr:tr/14,rsi:gain+loss?100*gain/(gain+loss):50,adx};
}
export function analyse(c:Candle[],market:string,symbol:string,minutes=15,now=Date.now()):Signal|null {
 const closed=c.filter(b=>b.time*1000+minutes*60000<=now);
 if(closed.length<60||closed.some((b,i)=>![b.time,b.open,b.high,b.low,b.close].every(Number.isFinite)||b.low<=0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||(i>0&&b.time<=closed[i-1].time)))return null;
 if(closed.slice(-60).some((b,i,a)=>i>0&&Math.abs(b.time-a[i-1].time-minutes*60)>1))return null;
 const last=closed.at(-1)!;if(now-(last.time*1000+minutes*60000)>minutes*60000)return null;
 const k=indicators(closed),previous=closed.slice(-21,-1);let side:Signal['side']|null=null;
 if(k.adx<20||Math.abs(k.ema20-k.ema50)<k.atr*.1)return null;
 if(k.ema20>k.ema50&&last.close>Math.max(...previous.map(b=>b.high))&&k.rsi>=50&&k.rsi<=75)side='BUY';
 if(k.ema20<k.ema50&&last.close<Math.min(...previous.map(b=>b.low))&&k.rsi>=25&&k.rsi<=50)side='SELL';
 if(!side||!Number.isFinite(k.atr)||k.atr<=0)return null;
 const d=k.atr*1.5,entry=last.close,stop=entry+(side==='BUY'?-d:d),target=entry+(side==='BUY'?2*d:-2*d);
 if(stop<=0||target<=0)return null;
 return {id:`v2:${minutes}:${market}:${symbol}:${last.time}:${side}`,market,symbol,side,entry,stop,target,time:(last.time+minutes*60)*1000,timeframe:minutes,reason:`Closed ${minutes}-minute range breakout; EMA 20/50 trend, ADX ${k.adx.toFixed(1)} and RSI ${k.rsi.toFixed(1)} filters. Stop 1.5 ATR; target 2R. Research rules, not a validated prediction.`};
}
export const dayKey=(n:number)=>new Date(n).toLocaleDateString('en-CA',{timeZone:'Africa/Lagos'});
export function openPaper(d:Desk,s:Signal,price:number):Desk {
 if(d.settings.paused)throw Error('Trading is paused.');
 if(d.trades.some(t=>t.id===s.id))throw Error('This signal already has a paper trade.');
 if(d.trades.filter(t=>t.status==='open').length>=d.settings.maxPositions)throw Error('Maximum open positions reached.');
 const today=d.trades.filter(t=>dayKey(t.time)===dayKey(Date.now()));
 const realized=d.trades.filter(t=>t.status==='closed'&&dayKey(t.closedAt!)===dayKey(Date.now())).reduce((n,t)=>n+(t.pnl??0)+t.fee,0)-today.reduce((n,t)=>n+t.fee,0);
 const base=d.balance-realized;
 if(realized<=-base*d.settings.daily/100)throw Error('Daily loss limit reached.');
 if(!(Number.isFinite(price)&&price>0))throw Error('A valid current price is required.');
 if(s.market==='Memecoins'&&s.side==='SELL')throw Error('Memecoin paper trading supports spot buys only.');
 if((s.side==='BUY'&&(price<=s.stop||price>=s.target))||(s.side==='SELL'&&(price>=s.stop||price<=s.target)))throw Error('Price has passed the signal stop or target.');
 const equity=d.balance; const budget=equity*d.settings.risk/100;const rate=0.001;
 let qty=budget/(Math.abs(price-s.stop)+2*price*rate);
 const openNotional=d.trades.filter(t=>t.status==='open').reduce((n,t)=>n+t.notional,0);
 const max=equity*(s.market==='Futures'?d.settings.leverage:1)-openNotional;
 qty=Math.min(qty,Math.max(0,max)/price);
 if(qty<=0)throw Error('Paper buying power is exhausted.');
 const notional=qty*price,fee=notional*rate,risk=qty*Math.abs(price-s.stop)+2*fee;
 const reserved=d.trades.filter(t=>t.status==='open').reduce((n,t)=>n+t.risk,0);
 if(reserved+risk>Math.max(0,base*d.settings.daily/100+realized))throw Error('Open-position risk would exceed the remaining daily loss budget.');
 const t:Trade={...s,entry:price,time:Date.now(),qty,notional,risk,fee,status:'open'};
 return {...d,balance:d.balance-fee,trades:[t,...d.trades]};
}
export function closePaper(d:Desk,id:string,price:number,closeReason:'manual'|'stop'|'target'='manual'):Desk {
 const t=d.trades.find(t=>t.id===id&&t.status==='open');if(!t)throw Error('Open position not found.');
 if(!(Number.isFinite(price)&&price>0))throw Error('A valid exit price is required.');
 const gross=(price-t.entry)*t.qty*(t.side==='BUY'?1:-1),exitFee=price*t.qty*0.001;
 return {...d,balance:d.balance+gross-exitFee,trades:d.trades.map(x=>x.id===id?{...x,status:'closed',exit:price,pnl:gross-t.fee-exitFee,closedAt:Date.now(),closeReason}:x)};
}
