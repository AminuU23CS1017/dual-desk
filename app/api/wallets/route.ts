import {identity,readDesk,saveDesk,fail} from '../../../lib/server';
import {sameOrigin} from '../../../lib/broker-security';
import {walletInput,walletKey} from '../../../lib/wallets';
const response=(wallets:unknown)=>Response.json({wallets},{headers:{'Cache-Control':'no-store'}});
export async function GET(){try{const {desk}=await readDesk(await identity());return response(desk.wallets??[])}catch(e){return fail(e)}}
export async function POST(r:Request){try{const uid=await identity(r);sameOrigin(r);const text=await r.text();if(text.length>2500)throw Error('Wallet details are too long.');const b=JSON.parse(text),{desk,revision}=await readDesk(uid);let wallets=desk.wallets??[];
 if(b.action==='save'){const wallet=walletInput(b.wallet),existing=wallets.find(w=>walletKey(w)===walletKey(wallet));if(!existing&&wallets.length>=30)throw Error('You can save up to 30 wallet addresses.');const saved={...wallet,id:existing?.id??crypto.randomUUID(),addedAt:existing?.addedAt??Date.now()};wallets=[saved,...wallets.filter(w=>w.id!==saved.id)];}
 else if(b.action==='remove'){if(typeof b.id!=='string'||!wallets.some(w=>w.id===b.id))throw Error('Saved wallet not found.');wallets=wallets.filter(w=>w.id!==b.id)}else throw Error('Unsupported wallet action.');
 await saveDesk(uid,{...desk,wallets},revision);return response(wallets);
 }catch(e){return fail(e)}}
