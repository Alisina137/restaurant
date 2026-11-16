import {notFound} from "next/navigation";
import {FinanceTransactions} from "@/components/finance-transactions";
export default async function Transactions({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="cashier")notFound();
 return <FinanceTransactions area="cashier"/>;
}