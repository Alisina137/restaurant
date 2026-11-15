import { notFound } from "next/navigation";
import { WorkspaceHome } from "@/components/workspace-home";
import { RestaurantOverview, PlatformOverview } from "@/components/phase2-overview";
const allowed: Record<string, string> = { app: "overview", kitchen: "live", cashier: "checks", platform: "overview" };
export default async function AreaHome({ params }: { params: Promise<{ area: string; screen: string }> }) {
  const { area, screen } = await params;
  if (allowed[area] !== screen) notFound();
  if(area==="app")return <RestaurantOverview/>;
  if(area==="platform")return <PlatformOverview/>;
  return <WorkspaceHome />;
}
