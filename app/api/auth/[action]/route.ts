import {hasValidOrigin} from '../../../lib/request-origin';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
const api=(process.env.API_URL||'http://localhost:4000/api/v1').replace(/\/$/,'');
const portal:string='rider';
const prefix=`barwaqt_${portal}`;
const options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
async function proxy(request:NextRequest,context:{params:Promise<{action:string}>}) {
 const {action}=await context.params;
 const allowed=request.method==='GET'?['me']:['login','refresh','logout'];
 if(!allowed.includes(action))return NextResponse.json({error:{message:'Route not found'}},{status:404});
 if(request.method!=='GET'&&!hasValidOrigin(request))return NextResponse.json({error:{message:'Invalid request origin'}},{status:403});
 const store=await cookies();
 const clear=()=>{store.delete(`${prefix}_access`);store.delete(`${prefix}_refresh`);};
 const save=(data:{accessToken:string;refreshToken:string;expiresIn:number})=>{store.set(`${prefix}_access`,data.accessToken,{...options,maxAge:data.expiresIn});store.set(`${prefix}_refresh`,data.refreshToken,{...options,maxAge:30*86400});};
 try {
 let access=store.get(`${prefix}_access`)?.value;
 const send=(path:string,method:string,body?:unknown,token?:string)=>fetch(`${api}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(20000)});
 const protectedAction=['me','logout','link-provider','profile','change-password'].includes(action);
 async function refresh(){const value=store.get(`${prefix}_refresh`)?.value;if(!value)return false;const r=await send('/auth/refresh','POST',{refreshToken:value});if(!r.ok){clear();return false;}const j=await r.json();save(j.data);access=j.data.accessToken;return true;}
 if(protectedAction&&!access)await refresh();
 let body:Record<string,unknown>|undefined;
 if(request.method!=='GET'){try{body=await request.json();}catch{return NextResponse.json({error:{message:'JSON body required'}},{status:422});}}
 if(['forgot-password','social','link-provider'].includes(action))body={...body,portal};
 if(action==='refresh'){if(!await refresh())return NextResponse.json({error:{message:'Sign in required'}},{status:401});return NextResponse.json({data:{refreshed:true}});}
 const path=action==='profile'?'/customer/profile':`/auth/${action}`;
 const method=action==='profile'?'PATCH':request.method;
 let response=await send(path,method,body,protectedAction?access:undefined);
 if(protectedAction&&response.status===401&&await refresh())response=await send(path,method,body,access);
 if(action==='logout'){clear();return NextResponse.json({data:{message:'Signed out'}});}
 const responseText=response.status===204?'':await response.text();
 let json;try{json=responseText?JSON.parse(responseText):{data:{}};}catch{json={error:{message:response.status===429?'Too many authentication requests. Please wait and try again.':'Authentication service returned an unexpected response.'}};}
 if(response.ok&&['login','register','social'].includes(action)){
  const user=json.data.user;
  if(user.role!=='RIDER'){await send('/auth/logout','POST',{},json.data.accessToken);return NextResponse.json({error:{message:'Use an administrator-registered rider account.'}},{status:403});}
  save(json.data);return NextResponse.json({data:{user}},{status:response.status});
 }
 if(protectedAction&&response.status===401)clear();
 return NextResponse.json(json,{status:response.status,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:{message:'Unable to reach the authentication service. Please try again.'}},{status:503});}
}
export const GET=proxy;
export const POST=proxy;
