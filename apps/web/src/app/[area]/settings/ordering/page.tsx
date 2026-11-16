import {notFound} from "next/navigation";
import {GuestOrderingRules} from "@/components/guest-ordering-rules";
export default async function RulesPage({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();
 return <GuestOrderingRules/>;
}
