/**
 * Development-only launcher UI helpers. Routes never grant authentication.
 * Guest entry consumes an existing opaque table QR token; this module does NOT
 * mint sessions, bypass the visit PIN, or construct a pretend customer identity.
 */
export const interfaceCards=[
 {id:"management",path:"/app/overview",kind:"web",roles:["owner","manager"]},
 {id:"waiter",path:null,kind:"expo",roles:["waiter"]},
 {id:"kitchen",path:"/kitchen/live",kind:"web",roles:["kitchen"]},
 {id:"cashier",path:"/cashier/checks",kind:"web",roles:["cashier"]},
 {id:"customer",path:null,kind:"guest",roles:[]},
 {id:"platform",path:"/platform/overview",kind:"web",roles:["platform_admin"]}
] as const;
export type InterfaceId=(typeof interfaceCards)[number]["id"];

/**
 * Accept only a generated DineFlow guest entry path (or a full http(s) URL).
 * Return a *local route*, never an untrusted host/redirect. This is a convenience
 * parser, not an authorization credential validator: the API enforces QR + PIN.
 */
export function parseGuestEntryRoute(value:string,baseOrigin:string):string|null{
 const trimmed=value.trim();
 if(!trimmed||trimmed.length>900)return null;
 try{
  const url=new URL(trimmed,baseOrigin);
  if(url.protocol!=="http:"&&url.protocol!=="https:")return null;
  if(url.username||url.password||url.search||url.hash)return null;
  const match=/^\/g\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,119})\/t\/([a-zA-Z0-9_-]{20,120})\/?$/.exec(url.pathname);
  return match?"/g/"+match[1]+"/t/"+match[2]:null;
 }catch{return null;}
}
export function apiReadyReply(value:unknown):boolean{
 return !!value&&typeof value==="object"&&
  (value as {status?:unknown}).status==="ready";
}
