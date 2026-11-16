import {ReportsConsole} from "@/components/reports-console";
import type {ReportTab} from "@/lib/report-types";
const allowed=new Set(["sales","items","service","audit"]);
export default async function ReportsPage({searchParams}:{searchParams:Promise<{tab?:string}>}){
 const {tab}=await searchParams;
 const initialTab:ReportTab=tab&&allowed.has(tab)?tab as ReportTab:"sales";
 return <ReportsConsole initialTab={initialTab}/>;
}
