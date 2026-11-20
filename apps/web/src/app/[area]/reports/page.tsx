import {notFound} from "next/navigation";
import {ReportsConsole} from "@/components/reports-console";
import type {ReportTab} from "@/lib/report-types";
const allowed=new Set(["sales","items","service","audit"]);
export default async function ReportsPage({params,searchParams}:{
 params:Promise<{area:string}>;searchParams:Promise<{tab?:string}>
}){
 const [{area},{tab}]=await Promise.all([params,searchParams]);
 // P43 release hardening: a restaurant financial report is not a cashier,
 // kitchen or platform page. Direct URL guesses must resolve to a 404.
 if(area!=="app")notFound();
 const initialTab:ReportTab=tab&&allowed.has(tab)?tab as ReportTab:"sales";
 return <ReportsConsole initialTab={initialTab}/>;
}
