import {notFound} from "next/navigation";
import {KitchenOperations} from "@/components/kitchen-operations";
export default async function PreparingPage({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="kitchen")notFound();
 return <KitchenOperations tab="preparing"/>;
}
