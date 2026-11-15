import { notFound } from "next/navigation";
import { StaffConsole } from "@/components/staff-console";
export default async function StaffPage({params}:{params:Promise<{area:string;tab:string}>}){
  const {area,tab}=await params;
  if(area!=="app"||!["directory","invitations","permissions"].includes(tab))notFound();
  return <StaffConsole tab={tab as "directory"|"invitations"|"permissions"}/>;
}
