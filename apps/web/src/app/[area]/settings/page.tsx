import {notFound} from "next/navigation";
import {SaasPlatformConsole} from "@/components/saas-platform-console";
export default async function Settings({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="platform")notFound();
 return <SaasPlatformConsole tab="settings"/>;
}
