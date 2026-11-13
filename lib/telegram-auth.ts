export function telegramAllowed(user:{userId:string;email:string},settings:Record<string,string>){
 const ids=(settings.TELEGRAM_ALLOWED_USER_IDS??'').split(',').map(s=>s.trim()).filter(Boolean);
 const emails=(settings.TELEGRAM_ALLOWED_EMAILS??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 return ids.includes(user.userId)||emails.includes(user.email.trim().toLowerCase());
}
