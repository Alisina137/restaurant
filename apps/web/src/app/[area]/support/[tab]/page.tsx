import {notFound} from "next/navigation";
import {SaasSupportConsole} from "@/components/saas-support-console";
export default async function SupportPage({params}:{params:Promise<{area:string;tab:string}>}){
 const {area,tab}=await params;
 if(!["platform","app"].includes(area)||!["tickets","grants"].includes(tab))notFound();
 return <SaasSupportConsole tab={tab as "tickets"|"grants"} area={area as "platform"|"app"}/>;
}
