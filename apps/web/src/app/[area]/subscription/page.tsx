import {notFound} from "next/navigation";
import {RestaurantSubscription} from "@/components/phase12-tenant";
export default async function Page({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();return <RestaurantSubscription/>;
}
