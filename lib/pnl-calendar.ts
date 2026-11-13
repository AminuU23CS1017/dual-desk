import type {Trade} from './desk';
export const watDay=(time:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
export function calendarMonth(month:string){
 const [year,m]=month.split('-').map(Number);
 const count=new Date(Date.UTC(year,m,0)).getUTCDate(),offset=(new Date(Date.UTC(year,m-1,1)).getUTCDay()+6)%7;
 return {offset,days:Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)};
}
export function shiftMonth(month:string,delta:number){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7)}
export function summarizeTrades(trades:Trade[]){const net=trades.reduce((n,t)=>n+t.pnl!,0),wins=trades.filter(t=>t.pnl!>0).length,losses=trades.filter(t=>t.pnl!<0).length;return {net,wins,losses,flat:trades.length-wins-losses,count:trades.length}}
export function calendarTrades(trades:Trade[],month:string,market='All'){
 const closed=trades.filter(t=>t.status==='closed'&&(market==='All'||t.market===market));
 const valid=closed.filter(t=>Number.isFinite(t.pnl)&&Number.isFinite(t.closedAt)&&t.closedAt!>0&&t.closedAt!<=8640000000000000);
 const rows=valid.filter(t=>watDay(t.closedAt!).startsWith(month+'-')).sort((a,b)=>b.closedAt!-a.closedAt!);
 const days=new Map<string,Trade[]>();for(const t of rows){const day=watDay(t.closedAt!);days.set(day,[...(days.get(day)??[]),t])}
 return {rows,days,excluded:closed.length-valid.length,...summarizeTrades(rows)};
}
