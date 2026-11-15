import Link from "next/link";
export default function NotFound() {
  return <main className="center-viewport"><section className="notice-card"><h1>Page unavailable</h1><p>This destination is not part of your active workspace.</p><Link className="button button-primary" href="/">Return to your workspace</Link></section></main>;
}
