import {notFound} from "next/navigation";
import {FloorConsole,type FloorTab} from "@/components/floor-console";
export default async function FloorPage({params}:{params:Promise<{area:string;tab:string}>}){
 const {area,tab}=await params;
 if(area!=="app"||!["board","manage"].includes(tab))notFound();
 return <FloorConsole tab={tab as FloorTab}/>;
}
