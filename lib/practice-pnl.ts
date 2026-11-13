import type {Trade} from './desk';
export function practiceMark(t:Trade,price:number,asOf:number,now=Date.now()){
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(asOf)||asOf>now+5000||now-asOf>90000)return null;
 const gross=(price-t.entry)*t.qty*(t.side==='BUY'?1:-1);
 return {price,asOf,gross,net:gross-t.fee-price*t.qty*.001};
}
