import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Barwaqt Rider',description:'Your shift. Your deliveries. Right on time.'};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#123c2e'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
