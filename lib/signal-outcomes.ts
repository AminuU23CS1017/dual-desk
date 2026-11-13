import type {Candle,Signal} from './desk';
export type Outcome={status:'pending'|'target_hit'|'stop_hit'|'ambiguous'|'data_gap';cursor:number;exit?:number;returnPct?:number;rMultiple?:number;closedAt?:number;evidence?:Candle};
// A signal is a reference setup, not proof that anyone entered a position.
export function evaluateSignal(s:Signal,cursor:number,candles:Candle[],now=Date.now()):Outcome{
 const rows=candles.filter(c=>c.time>=cursor&&c.time*1000+60000<=now).sort((a,b)=>a.time-b.time);
 let next=cursor;
 for(const b of rows){
  if(b.time>next||![b.time,b.open,b.high,b.low,b.close].every(Number.isFinite)||b.low<=0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close))return {status:'data_gap',cursor:next};
  if(b.time<next)continue;
  const stop=s.side==='BUY'?b.low<=s.stop:b.high>=s.stop,target=s.side==='BUY'?b.high>=s.target:b.low<=s.target;
  if(stop&&target)return {status:'ambiguous',cursor:b.time+60,closedAt:(b.time+60)*1000,evidence:{time:b.time,open:b.open,high:b.high,low:b.low,close:b.close}};
  if(stop||target){const level=stop?s.stop:s.target;const exit=stop?(s.side==='BUY'?Math.min(level,b.open):Math.max(level,b.open)):level;const move=(exit-s.entry)*(s.side==='BUY'?1:-1);return {status:stop?'stop_hit':'target_hit',cursor:b.time+60,exit,returnPct:move/s.entry*100,rMultiple:move/Math.abs(s.entry-s.stop),closedAt:(b.time+60)*1000,evidence:{time:b.time,open:b.open,high:b.high,low:b.low,close:b.close}}}
  next=b.time+60;
 }
 return {status:'pending',cursor:next};
}

// Keep the requested 200-candle window near the cursor, including after long outages.
export function outcomeHistoryEnd(cursor:number,now=Date.now()){
 if(!Number.isInteger(cursor)||cursor<=0)throw Error('Invalid outcome cursor.');
 return Math.min(cursor+199*60,Math.floor(now/60000)*60-1);
}
