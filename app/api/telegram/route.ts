import {deliverSignal} from '../../../lib/telegram-delivery';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {identity,readDesk,fail} from '../../../lib/server';
import {telegramAllowed} from '../../../lib/telegram-auth';
export async function GET(){try{await identity();const user=(await getChatGPTUser())!;const e=env as unknown as Record<string,string>;const available=!!(e.TELEGRAM_BOT_TOKEN&&e.TELEGRAM_CHAT_ID);const allowed=telegramAllowed(user,e);return Response.json({configured:available&&allowed,status:!available?'setup_needed':allowed?'connected':'restricted',botUsername:available?'aped2bot':null},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e)}}
export async function POST(r:Request){try{
 const uid=await identity(r),user=(await getChatGPTUser())!,body=await r.json() as {id?:string;action?:string};
 const e=env as unknown as Record<string,string>;
 if(!e.TELEGRAM_BOT_TOKEN||!e.TELEGRAM_CHAT_ID)throw Error('Telegram setup is not complete yet.');
 if(!telegramAllowed(user,e))throw Error('Only approved accounts can send to the private Telegram group. Sign in with the website owner account.');
 let text:string;
 if(body.action==='test'){text='Dual Desk connection test\nTelegram is connected. You can send saved paper signals from your trading desk. Automatic alerts follow the monitor status in Accounts & bots. Qualifying signals and tracked results are sent while enabled.';}
 else {const {desk}=await readDesk(uid),s=desk.signals.find(x=>x.id===body.id);if(!s)throw Error('Save a signal before sending it.');const delivery=await deliverSignal(uid,s);if(delivery.status!=='sent')throw Error(`Telegram delivery ${delivery.status}. Check Profit & loss for delivery status.`);return Response.json({sent:true,duplicate:delivery.duplicate});}
 const result=await fetch(`https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:e.TELEGRAM_CHAT_ID,text}),signal:AbortSignal.timeout(10000)});
 const data=await result.json() as {ok?:boolean};if(!result.ok||!data.ok)throw Error('Telegram delivery failed. Check that the bot is still in the group and can send messages.');return Response.json({sent:true});
 }catch(e){return fail(e)}}
