import {notFound} from "next/navigation";
import {SaasInvoicePrint} from "@/components/saas-restaurant-console";
export default async function SubscriptionInvoice({params}:{params:Promise<{area:string;id:string}>}){
 const {area,id}=await params;if(area!=="app")notFound();
 return <SaasInvoicePrint id={id}/>;
}
