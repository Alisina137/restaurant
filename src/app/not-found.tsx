import Link from "next/link";
export default function NotFound() {
  return (
    <section className="card empty">
      <h1>This page isn’t available.</h1>
      <p>It may be private, removed or waiting for review.</p>
      <Link className="button" href="/">
        Browse restaurants
      </Link>
    </section>
  );
}
