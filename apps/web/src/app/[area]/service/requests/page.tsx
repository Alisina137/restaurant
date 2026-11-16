import {notFound} from "next/navigation";
import {ServiceRequestsConsole} from "@/components/service-requests-console";
export default async function Service({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();return <ServiceRequestsConsole/>;
}
