import {notFound} from "next/navigation";
import {ReceiptView} from "@/components/finance-receipts";
export default async function Receipt({params}:{params:Promise<{area:string;id:string}>}){
 const {area,id}=await params;if(area!=="app")notFound();return <ReceiptView id={id} area="app"/>;
}