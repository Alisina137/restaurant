import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DineFlow | Restaurant workspace",
  description: "Secure restaurant workspace for service teams."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa-AF" dir="rtl" suppressHydrationWarning><body>{children}</body></html>;
}
