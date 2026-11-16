import {notFound} from "next/navigation";
import {FinanceShiftOversight} from "@/components/finance-shift-oversight";
export default async function Shifts({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();
 return <FinanceShiftOversight/>;
}