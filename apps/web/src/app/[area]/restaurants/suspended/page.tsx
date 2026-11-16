import {notFound} from "next/navigation";
import {SaasTenants} from "@/components/saas-tenants";
export default async function Suspended({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="platform")notFound();return <SaasTenants filter="suspended"/>;
}
