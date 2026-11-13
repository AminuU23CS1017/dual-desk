export class FeedError extends Error{
 constructor(message:string,public code:string,public retryAfter=0){super(message);this.name='FeedError'}
}
export function retryDelay(value:string|null,now=Date.now()){
 if(!value)return 15*60*1000;const seconds=Number(value);const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
 return Math.min(24*3600000,Math.max(60000,Number.isFinite(delay)?delay:15*60000));
}
export function derivError(error:any){const code=typeof error?.code==='string'?error.code.replace(/[^\w-]/g,'').slice(0,80):'UNKNOWN';return new FeedError(`Deriv rejected market data (${code}).`,code,/rate|limit|throttle/i.test(code)?15*60000:0)}
