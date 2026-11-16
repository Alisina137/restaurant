import {API_URL} from "./auth-client";
import {Phase2Error} from "./phase2-api";
export async function downloadReport(kind:string,query:string){
 const response=await fetch(API_URL+"/api/reports/export?kind="+encodeURIComponent(kind)+query,{
  credentials:"include",cache:"no-store",headers:{"Accept":"text/csv"}});
 if(!response.ok){
  const data=await response.json().catch(()=>({})) as {code?:string;message?:string};
  throw new Phase2Error(response.status,data.code??"EXPORT_FAILED",data.message??"Export failed.");
 }
 const blob=await response.blob(),url=URL.createObjectURL(blob);
 try{
  const a=document.createElement("a");a.href=url;
  const disposition=response.headers.get("Content-Disposition")??"";
  const match=/filename="([^"]+)"/.exec(disposition);
  a.download=match?.[1]??"dineflow-report.csv";
  document.body.appendChild(a);a.click();a.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),2000);}
}
