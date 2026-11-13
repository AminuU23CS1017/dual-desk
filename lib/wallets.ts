export type SavedWallet={id:string;label:string;provider:'Phantom'|'MetaMask'|'Trust Wallet'|'Other';network:'Solana'|'EVM';chainId?:string;address:string;addedAt:number};
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function validSolanaAddress(value:string){if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))return false;let n=BigInt(0);for(const c of value)n=n*BigInt(58)+BigInt(alphabet.indexOf(c));let bytes=0;while(n){bytes++;n>>=BigInt(8);}return bytes+(value.match(/^1*/)?.[0].length??0)===32;}
export function walletInput(input:any):Omit<SavedWallet,'id'|'addedAt'>{
 if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['label','provider','network','chainId','address'].includes(k)))throw Error('Save only a label, network and public wallet address.');
 const {provider,network}=input,label=typeof input.label==='string'?input.label.trim():'',address=typeof input.address==='string'?input.address.trim():'';
 if(!label||label.length>60||!['Phantom','MetaMask','Trust Wallet','Other'].includes(provider)||!['Solana','EVM'].includes(network))throw Error('Choose a wallet name and network.');
 if(network==='Solana'?!validSolanaAddress(address):!/^0x[0-9a-fA-F]{40}$/.test(address))throw Error('Enter a valid public address for the selected network. Never enter a recovery phrase or private key.');
 if(network==='EVM'&&input.chainId!==undefined&&!/^0x[0-9a-fA-F]{1,16}$/.test(input.chainId))throw Error('Invalid EVM network ID.');
 return {label,provider,network,address:network==='EVM'?address.toLowerCase():address,...(network==='EVM'&&input.chainId?{chainId:'0x'+BigInt(input.chainId).toString(16)}:{})};
}
export function walletKey(w:Pick<SavedWallet,'network'|'address'|'chainId'>){return `${w.network}:${w.address}:${w.chainId??''}`;}
export function networkLabel(w:Pick<SavedWallet,'network'|'chainId'>){return w.network==='Solana'?'Solana':({'0x1':'Ethereum','0x38':'BNB Smart Chain','0x89':'Polygon','0x2105':'Base','0xa4b1':'Arbitrum','0xa':'Optimism'}[w.chainId??'']??(w.chainId?`EVM · ${w.chainId}`:'EVM · network not specified'));}
