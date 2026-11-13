import {identity,fail} from '../../../lib/server';
import {alertUser,alertStatus,toggleAlerts,scanAlerts} from '../../../lib/alerts';
export async function GET(){try{await alertUser();return Response.json(await alertStatus(),{headers:{'Cache-Control':'no-store'}})}catch(e){return fail(e)}}
export async function POST(r:Request){try{await identity(r);const u=await alertUser();const b=await r.json() as {enabled?:boolean;action?:string};if(b.action==='scan')return Response.json(await scanAlerts(u.userId));if(typeof b.enabled!=='boolean')throw Error('Choose enabled or paused.');return Response.json(await toggleAlerts(b.enabled));}catch(e){return fail(e)}}
