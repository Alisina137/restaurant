import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {DeveloperInterfaceLauncher} from "@/components/developer-interface-launcher";

/**
 * The launcher is not a normal product route. Production requests always 404;
 * never expose dev accounts, credentials, seeded tokens or auth bypasses.
 */
export const dynamic="force-dynamic";
export const metadata:Metadata={
 title:"DineFlow | Developer interface launcher",
 robots:{index:false,follow:false,noarchive:true}
};
export default function DevInterfacesPage(){
 if(process.env.NODE_ENV!=="development")notFound();
 return <DeveloperInterfaceLauncher/>;
}
