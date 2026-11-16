import {GuestShell} from "@/components/guest-shell";
export default async function GuestSessionLayout({children,params}:{children:React.ReactNode;params:Promise<{visit:string}>}){
 const {visit}=await params;
 return <GuestShell visit={visit}>{children}</GuestShell>;
}
