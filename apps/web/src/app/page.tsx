"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getContext } from "@/lib/context";
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    getContext().then((c) => { if (active) router.replace(c.defaultRoute); })
      .catch(() => { if (active) router.replace("/login"); });
    return () => { active = false; };
  }, [router]);
  return <main className="center-viewport"><div className="spinner" aria-label="Loading" /></main>;
}
