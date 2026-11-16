import {notFound} from "next/navigation";
import {FinanceChargeSettings} from "@/components/finance-settings";
export default async function Charges({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();return <FinanceChargeSettings/>;
}