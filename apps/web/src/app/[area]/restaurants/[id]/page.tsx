import { notFound } from "next/navigation";
import { PlatformRestaurants } from "@/components/platform-restaurants";
export default async function PlatformDetail({params}:{params:Promise<{area:string;id:string}>}){
  const {area,id}=await params;
  if(area!=="platform")notFound();
  return <PlatformRestaurants id={id}/>;
}
