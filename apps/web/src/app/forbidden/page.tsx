import Link from "next/link";
export default function Forbidden() {
  return <main className="center-viewport"><section className="notice-card"><h1>Access denied</h1><p>Your role does not permit access to this workspace.</p><Link className="button button-primary" href="/">Return to your workspace</Link></section></main>;
}
