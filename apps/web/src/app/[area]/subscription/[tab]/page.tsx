import {notFound} from "next/navigation";
import {SaasRestaurantConsole} from "@/components/saas-restaurant-console";
export default async function SubscriptionTab({params}:{params:Promise<{area:string;tab:string}>}){
 const {area,tab}=await params;
 if(area!=="app"||!["plan","invoices"].includes(tab))notFound();
 return <SaasRestaurantConsole tab={tab as "plan"|"invoices"}/>;
}
