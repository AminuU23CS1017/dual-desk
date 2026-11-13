const reasons:Record<string,string>={
 site_session:'Dual Desk could not confirm your website sign-in. Sign in to Dual Desk, then try connecting again.',
 authorization:'Deriv returned without a complete authorization. Start a new connection using the button below.',
 access_denied:'Access was not approved on Deriv. Connect again if you want to authorize Dual Desk.',
 invalid_scope:'Deriv rejected the application permissions. The app configuration needs checking.',
 state:'This connection attempt expired or was replaced by another attempt. Use one tab and click Connect my Deriv account once.',
 encryption:'Dual Desk could not read its saved connection request. The site configuration needs checking.',
 token_exchange:'Deriv returned you here, but the server could not finish exchanging the sign-in code. This is a connection issue, not a request to register again.',
 expired_code:'Deriv rejected the sign-in code because it expired, was already used, or did not match this request. Start a fresh connection in one tab.',
 app_registration:'Deriv rejected the registered application. The App ID and registration need checking.',
 token_response:'Deriv returned an unexpected sign-in response. The connection code needs checking.',
 account_fetch:'Deriv returned you here, but the site could not retrieve your Options accounts. The account API connection needs checking.',
 account_response:'Deriv returned account details in a format the site could not read. The connection code needs updating.',
 save_connection:'The site could not save the authorized connection. Please report the reference below.',
};
export function derivConnectionMessage(reason:string|null,reference:string|null){
 const message=reason&&reasons[reason]||'The previous Deriv connection did not finish. Try once more to get a specific error message.';
 return message+(reference&&/^[a-f0-9-]{36}$/.test(reference)?` Reference: ${reference}.`:'');
}
