import Link from "next/link";
import { Store, ArrowUpRight, MapPin } from "lucide-react";
import type { ReactNode } from "react";
export function Title({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-title">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <div className="muted">{children}</div>}
    </header>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="empty card">
      <span className="icon-tile">
        <Store size={28} />
      </span>
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </section>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value}>{value.replaceAll("_", " ")}</span>
  );
}
export function RestaurantCard({
  r,
}: {
  r: {
    id: string;
    slug: string;
    name: string;
    city: string;
    area: string;
    cuisine: string;
    description: string;
  };
}) {
  return (
    <Link className="restaurant-card card" href={`/restaurants/${r.slug}`}>
      <div className="restaurant-art">
        <Store size={42} />
        <span>{r.cuisine}</span>
      </div>
      <div className="restaurant-card-body">
        <div className="row spread">
          <h2>{r.name}</h2>
          <ArrowUpRight size={20} />
        </div>
        <p className="muted location">
          <MapPin size={15} />
          {r.area}, {r.city}
        </p>
        <p className="clamp">{r.description}</p>
        <span className="small muted">View restaurant</span>
      </div>
    </Link>
  );
}
