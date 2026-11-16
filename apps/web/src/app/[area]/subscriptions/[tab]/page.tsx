import {notFound} from "next/navigation";
import {SaasPlatformConsole} from "@/components/saas-platform-console";
export default async function PlatformSubscriptionTab({params}:{params:Promise<{area:string;tab:string}>}){
 const {area,tab}=await params;
 if(area!=="platform"||!["plans","invoices","payments"].includes(tab))notFound();
 return <SaasPlatformConsole tab={tab as "plans"|"invoices"|"payments"}/>;
}
