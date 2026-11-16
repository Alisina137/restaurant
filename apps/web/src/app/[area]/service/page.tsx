import {notFound} from "next/navigation";
import {ServiceConsole} from "@/components/service-console";
export default async function ServicePage({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();return <ServiceConsole/>;
}