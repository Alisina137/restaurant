import {notFound} from "next/navigation";
import {TableQRConsole} from "@/components/table-qr-console";
export default async function QrPage({params}:{params:Promise<{area:string}>}){
 const {area}=await params;if(area!=="app")notFound();
 return <TableQRConsole/>;
}
