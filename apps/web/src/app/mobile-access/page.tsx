"use client";
import Link from "next/link";
import { Smartphone, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export default function MobileAccessPage() {
  const router = useRouter();
  return <main className="center-viewport"><section className="notice-card"><Smartphone size={32} /><h1>Waiter mobile access</h1><p>Please use the DineFlow waiter app on your phone to open your waiter workspace.</p><button className="button button-primary" onClick={async () => { await authClient.signOut(); router.replace("/login"); }}><LogOut size={18} /> Sign out</button><Link className="text-link" href="/">Go to workspace</Link></section></main>;
}
