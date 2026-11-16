import {notFound} from "next/navigation";
import {RestaurantSupport} from "@/components/phase12-tenant";
import {PlatformSupport} from "@/components/phase12-platform";
export default async function Page({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area==="app")return <RestaurantSupport/>;
 if(area==="platform")return <PlatformSupport/>;notFound();
}
