import {notFound} from "next/navigation";
import {CashierChecks} from "@/components/finance-checks";
export default async function Checks({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();return <CashierChecks area="app"/>;
}