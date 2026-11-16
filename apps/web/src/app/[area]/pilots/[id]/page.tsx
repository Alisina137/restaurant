import {notFound} from "next/navigation";
import {PilotReview} from "@/components/phase14-pilot";
export default async function Page({params}:{params:Promise<{area:string;id:string}>}){
 const {area,id}=await params;if(area!=="platform")notFound();return <PilotReview tenantId={id}/>;
}
