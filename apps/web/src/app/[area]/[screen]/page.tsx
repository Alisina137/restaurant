import { notFound } from "next/navigation";
import { WorkspaceHome } from "@/components/workspace-home";
import { RestaurantOverview } from "@/components/phase2-overview";
import {SaasPlatformOverview} from "@/components/saas-platform-console";
import { KitchenOperations } from "@/components/kitchen-operations";
import {CashierChecks} from "@/components/finance-checks";
const allowed: Record<string, string> = { app: "overview", kitchen: "live", cashier: "checks", platform: "overview" };
export default async function AreaHome({ params }: { params: Promise<{ area: string; screen: string }> }) {
  const { area, screen } = await params;
  if (allowed[area] !== screen) notFound();
  if(area==="app")return <RestaurantOverview/>;
  if(area==="platform")return <SaasPlatformOverview/>;
  if(area==="kitchen")return <KitchenOperations tab="new"/>;
  if(area==="cashier")return <CashierChecks area="cashier"/>;
  return <WorkspaceHome />;
}
