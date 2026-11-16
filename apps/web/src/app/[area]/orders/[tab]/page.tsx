import {notFound} from "next/navigation";
import {ManagementOrders} from "@/components/order-console";
export default async function OrdersPage({params}:{params:Promise<{area:string;tab:string}>}){
 const {area,tab}=await params;
 if(area!=="app"||!["live","history"].includes(tab))notFound();
 return <ManagementOrders tab={tab as "live"|"history"}/>;
}
