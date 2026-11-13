export function telegramResult(httpStatus:number,data:any,attempts:number,now=Date.now()){
 if(httpStatus>=200&&httpStatus<300&&data?.ok===true)return {status:'sent',retryAt:0,errorCode:null};
 const code=Number.isInteger(data?.error_code)?data.error_code:httpStatus;
 // Retry only explicit flood-control rejection. A lost response may have sent.
 if(code===429&&data?.ok===false&&attempts<3){const seconds=Number(data.parameters?.retry_after);return {status:'retry_wait',retryAt:now+Math.max(1000,Math.min(86400000,Number.isFinite(seconds)&&seconds>0?seconds*1000:60000)),errorCode:'429'}}
 return {status:httpStatus>=500?'uncertain':'failed',retryAt:0,errorCode:String(code)};
}
