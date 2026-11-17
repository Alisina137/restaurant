import {API_URL,authClient} from "./auth-client";
import {observedFetch} from "./network-status";
export class FloorRequestError extends Error{
 constructor(public readonly status:number,public readonly code:string,message:string){super(message);}
}
export async function floorRequest<T>(path:string,options?:{method?:string;body?:unknown}):Promise<T>{
 const cookie=await authClient.getCookie();
 const response=await observedFetch(API_URL+path,{method:options?.method??"GET",
  credentials:"omit",headers:{Cookie:cookie??"","Content-Type":"application/json"},
  body:options?.body===undefined?undefined:JSON.stringify(options.body)});
 const result=await response.json().catch(()=>({})) as {code?:string;message?:string};
 if(!response.ok)throw new FloorRequestError(response.status,result.code??"REQUEST_FAILED",
  result.message??"Could not reach the restaurant server.");
 return result as T;
}
