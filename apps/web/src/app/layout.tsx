import "./globals.css";
import "./design-system.css";
import "./workspace-navigation.css";
import "./interaction-system.css";
import "./auth-experience.css";
import "./dashboard.css";
import "./menu20.css";
import "./floor21.css";
import "./staff22.css";
import "./kitchen27.css";
import "./kitchen28.css";
import "./kitchen29.css";
import "./kitchen30.css";
import "./kitchen31.css";
import "./pilot32.css";
import "./pilot33.css";
import "./pilot41.css";
import "./finance42.css";
import "./dev-launcher.css";
import "./phase35.css";
import "./phase36.css";
import {InteractionProvider} from "@/components/ui/interaction-provider";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DineFlow | Restaurant workspace",
  description: "Secure restaurant workspace for service teams."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa-AF" dir="rtl" suppressHydrationWarning>
      {/* Browser extensions (e.g. Titans Quick View) may inject data-* attributes
          directly into <body> before React hydrates. Suppress only this element's
          attribute warning; child subtree hydration warnings still surface. */}
      <body suppressHydrationWarning>
        <InteractionProvider>{children}</InteractionProvider>
      </body>
    </html>
  );
}
