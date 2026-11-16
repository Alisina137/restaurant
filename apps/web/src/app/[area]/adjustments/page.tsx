import {AdjustmentConsole} from "@/components/finance-adjustments";
export default async function Adjustments({searchParams}:{searchParams:Promise<{checkId?:string}>}){
 const {checkId}=await searchParams;
 return <AdjustmentConsole area="cashier" initialCheckId={checkId??""}/>;
}
