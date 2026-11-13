import DeskApp from './desk-app';
import {getChatGPTUser} from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();return <DeskApp user={user?.displayName??null}/>}
