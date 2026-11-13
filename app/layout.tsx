import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Dual Desk | Charts and practice trading',description:'Forex, synthetic indices, memecoins and futures research with paper trading.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
