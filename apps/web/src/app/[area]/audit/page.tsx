import {notFound} from "next/navigation";
import {SaasPlatformConsole} from "@/components/saas-platform-console";
export default async function Audit({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="platform")notFound();
 return <SaasPlatformConsole tab="audit"/>;
}
