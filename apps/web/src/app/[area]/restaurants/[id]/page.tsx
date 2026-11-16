import { notFound } from "next/navigation";
import { SaasTenants } from "@/components/saas-tenants";
export default async function PlatformDetail({params}:{params:Promise<{area:string;id:string}>}){
  const {area,id}=await params;
  if(area!=="platform")notFound();
  return <SaasTenants id={id}/>;
}
