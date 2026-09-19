import Link from "next/link";
import { ArrowUpRight, MapPin, BadgeCheck } from "lucide-react";
import { Title, Empty, RestaurantCard } from "@/components/ui";
import { listPublic } from "@/features/restaurants/service";
import { runtime } from "@/lib/runtime";
import { configured } from "@/lib/env";
export default async function Home() {
  const ready = configured();
  const restaurants = ready ? await listPublic(runtime().db) : [];
  return (
    <>
      <Title
        eyebrow="GOOD FOOD, CLOSER TO HOME"
        title="Meet your local kitchens."
      >
        <p>Discover the people and places behind your next favourite meal.</p>
      </Title>
      <div className="discovery-strip">
        <span className="location">
          <MapPin size={18} />
          Afghanistan
        </span>
        <span className="muted small">Restaurant directory</span>
      </div>
      <div className="row spread section-heading">
        <h2>Restaurants to discover</h2>
        <span className="muted small">{restaurants.length} listed</span>
      </div>
      {restaurants.length ? (
        <div className="restaurant-grid">
          {restaurants.map((r) => (
            <RestaurantCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        <Empty title="Your neighbourhood starts here.">
          <p>Restaurant pages will appear here once they have been reviewed.</p>
          <Link className="button" href="/owner/onboarding">
            Introduce your restaurant <ArrowUpRight size={17} />
          </Link>
        </Empty>
      )}
      <div className="onboarding-banner">
        <div>
          <span className="eyebrow">FOR RESTAURANT OWNERS</span>
          <h2>Your food. Your story. Your page.</h2>
          <p className="muted">
            Add your details, show your space, and make it easier for people to
            find you.
          </p>
        </div>
        <Link className="button secondary" href="/owner/onboarding">
          Create a restaurant page
        </Link>
      </div>
      <p className="footnote">
        <BadgeCheck size={16} />
        Restaurant pages are reviewed before becoming public.
      </p>
    </>
  );
}
