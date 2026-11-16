import {notFound} from "next/navigation";
import {FinanceShifts} from "@/components/finance-shifts";
export default async function Shifts({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="cashier")notFound();return <FinanceShifts/>;
}