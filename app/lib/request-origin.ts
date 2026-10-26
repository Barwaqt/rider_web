/** Check the browser-facing host, not Next.js's internal 0.0.0.0 bind address. */
export function hasValidOrigin(request: {url:string;headers:Headers}, configuredOrigin=process.env.APP_ORIGIN):boolean {
 const raw=request.headers.get('origin');
 if(!raw||raw==='null')return false;
 try {
  const origin=new URL(raw);
  if(!['http:','https:'].includes(origin.protocol)||origin.origin!==raw)return false;
  if(configuredOrigin)return origin.origin===new URL(configuredOrigin).origin;
  const host=request.headers.get('host');
  if(!host||/[\s,/@\\]/.test(host))return false;
  const expected=new URL(`${new URL(request.url).protocol}//${host}`);
  return origin.origin===expected.origin;
 }catch{return false;}
}
