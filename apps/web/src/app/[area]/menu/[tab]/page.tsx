import {notFound} from "next/navigation";
import {MenuConsole,type MenuTab} from "@/components/menu-console";
const allowed:MenuTab[]=["items","categories","modifiers","availability"];
export default async function MenuPage({params}:{params:Promise<{area:string;tab:string}>}){
  const {area,tab}=await params;
  if(area!=="app"||!allowed.includes(tab as MenuTab))notFound();
  return <MenuConsole tab={tab as MenuTab}/>;
}
