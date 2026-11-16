import {GuestVerify} from "@/components/guest-verify";
export default async function GuestEntryPage({params}:{params:Promise<{visit:string;qr:string}>}){
 const {visit,qr}=await params;
 return <GuestVerify slug={visit} qr={qr}/>;
}
