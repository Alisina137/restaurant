import {notFound} from "next/navigation";
import {CashierCheckDetails} from "@/components/finance-check-detail";
export default async function Check({params}:{params:Promise<{area:string;id:string}>}){
 const {area,id}=await params;if(area!=="app")notFound();return <CashierCheckDetails id={id} area="app"/>;
}