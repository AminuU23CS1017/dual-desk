const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const str=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
const id=(v:unknown)=>typeof v==='string'&&/^\d{1,20}$/.test(v);
export function mt5Snapshot(b:any){
 if(!b||!id(b.login)||!str(b.server,120)||!['demo','real','contest'].includes(b.mode)||!['balance','equity','marginFree','positions'].every(k=>finite(b[k]))||!Number.isInteger(b.positions)||b.positions<0||!str(b.currency,12))throw Error('Invalid MT5 account report');
 const base={login:b.login,server:b.server,mode:b.mode,balance:b.balance,equity:b.equity,marginFree:b.marginFree,positions:b.positions,currency:b.currency,symbol:str(b.symbol,80)?b.symbol:'',status:str(b.status,200)?b.status:''};
 if(b.version!=='1.10')return {...base,version:'1.00'};
 if(!Array.isArray(b.openPositions)||b.openPositions.length>50||typeof b.positionsComplete!=='boolean'||!str(b.brokerDay,10)||!/^\d{4}-\d{2}-\d{2}$/.test(b.brokerDay)||!Array.isArray(b.deals)||b.deals.length>500||typeof b.historyComplete!=='boolean')throw Error('Invalid MT5 detail report');
 const ids=new Set<string>();const openPositions=b.openPositions.map((p:any)=>{
 if(!id(p.ticket)||ids.has(p.ticket)||!str(p.symbol,80)||!['BUY','SELL'].includes(p.side)||!['volume','entry','current','stop','target','profit','swap','openedAt'].every(k=>finite(p[k]))||p.volume<=0||p.entry<=0||p.current<=0||p.stop<0||p.target<0||p.openedAt<=0||!str(p.comment,120))throw Error('Invalid MT5 position');ids.add(p.ticket);
 return {ticket:p.ticket,symbol:p.symbol,side:p.side,volume:p.volume,entry:p.entry,current:p.current,stop:p.stop,target:p.target,profit:p.profit,swap:p.swap,openedAt:p.openedAt,comment:p.comment};
 });
 if(openPositions.length>b.positions||(b.positionsComplete&&openPositions.length!==b.positions))throw Error('Incomplete MT5 positions');
 const dealsSeen=new Set<string>();const deals=b.deals.map((d:any)=>{if(!id(d.ticket)||dealsSeen.has(d.ticket)||!str(d.symbol,80)||!['BUY','SELL'].includes(d.side)||!['IN','OUT','INOUT','OUT_BY'].includes(d.entryType)||!['profit','commission','swap','fee','time','volume','price'].every(k=>finite(d[k]))||d.time<=0||d.volume<=0||d.price<=0)throw Error('Invalid MT5 deal');dealsSeen.add(d.ticket);return {ticket:d.ticket,symbol:d.symbol,side:d.side,entryType:d.entryType,profit:d.profit,commission:d.commission,swap:d.swap,fee:d.fee,time:d.time,volume:d.volume,price:d.price,net:d.profit+d.commission+d.swap+d.fee}});
 return {...base,version:b.version,positionsComplete:b.positionsComplete,openPositions,brokerDay:b.brokerDay,historyComplete:b.historyComplete,deals,dailyNet:deals.reduce((n:number,d:any)=>n+d.net,0)};
}
