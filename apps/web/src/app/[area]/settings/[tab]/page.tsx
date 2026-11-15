import { notFound } from "next/navigation";
import { RestaurantSettings } from "@/components/restaurant-settings";
export default async function SettingsPage({params}:{params:Promise<{area:string;tab:string}>}){
  const {area,tab}=await params;
  if(area!=="app"||!["restaurant","localization","security"].includes(tab))notFound();
  return <RestaurantSettings tab={tab as "restaurant"|"localization"|"security"}/>;
}
