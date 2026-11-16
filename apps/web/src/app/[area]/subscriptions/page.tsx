import {notFound} from "next/navigation";
import {PlatformSubscriptions} from "@/components/phase12-platform";
export default async function Page({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="platform")notFound();return <PlatformSubscriptions/>;
}
