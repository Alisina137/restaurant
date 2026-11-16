import {Suspense} from "react";
import {GuestItemPage} from "@/components/guest-pages";
export default async function ItemPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;return <Suspense fallback={<div className="guest-loading-inline">…</div>}><GuestItemPage id={id}/></Suspense>;
}
