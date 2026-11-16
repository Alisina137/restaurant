import {notFound} from "next/navigation";
import {PilotReview} from "@/components/phase14-pilot";
export default async function Page({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();return <PilotReview/>;
}
