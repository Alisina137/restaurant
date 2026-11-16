import {notFound} from "next/navigation";
import {FinanceReceipts} from "@/components/finance-receipts";
export default async function Receipts({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();return <FinanceReceipts area="app"/>;
}