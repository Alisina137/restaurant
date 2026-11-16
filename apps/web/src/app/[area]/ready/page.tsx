import {notFound} from "next/navigation";
import {KitchenConsole} from "@/components/order-console";
export default async function ReadyPage({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="kitchen")notFound();
 return <KitchenConsole tab="ready"/>;
}
