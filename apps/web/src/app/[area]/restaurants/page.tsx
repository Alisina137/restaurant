import { notFound } from "next/navigation";
import { PlatformRestaurants } from "@/components/platform-restaurants";
export default async function PlatformList({params}:{params:Promise<{area:string}>}){
  const {area}=await params;
  if(area!=="platform")notFound();
  return <PlatformRestaurants/>;
}
