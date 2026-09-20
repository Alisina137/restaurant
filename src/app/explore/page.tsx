import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Clock3,
  Filter,
  MapPin,
  Search,
  Store,
} from "lucide-react";
import { searchRestaurants } from "@/features/discovery/service";
import { runtime } from "@/lib/runtime";
import { configured } from "@/lib/env";
import { currentUser } from "@/lib/session";
import { FollowButton } from "@/components/social-actions";

const cities = ["Kabul", "Herat", "Mazar-i-Sharif", "Kandahar", "Jalalabad"];
const cuisines = ["Afghan", "Pizza", "Burgers", "Cafe", "Asian", "Other"];

export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const actor = configured() ? await currentUser().catch(() => null) : null;
  const filters = {
    q: query.q,
    city: cities.includes(query.city || "") ? query.city : undefined,
    area: query.area,
    cuisine: cuisines.includes(query.cuisine || "") ? query.cuisine : undefined,
    open: query.open === "1",
    delivery: query.delivery === "1",
    pickup: query.pickup === "1",
    actorId: actor?.id,
  };
  const results = configured()
    ? await searchRestaurants(runtime().db, filters)
    : [];
  const filtered = Boolean(
    filters.q ||
    filters.city ||
    filters.area ||
    filters.cuisine ||
    filters.open ||
    filters.delivery ||
    filters.pickup,
  );

  return (
    <div className="explore-page">
      <header className="explore-heading">
        <p className="eyebrow">EXPLORE YOUR CITY</p>
        <h1>Find food that feels close.</h1>
        <p className="muted">
          Search approved restaurants by name, neighbourhood, cuisine and
          current service.
        </p>
      </header>
      <form className="search-panel" action="/explore">
        <label className="search-field">
          <Search size={20} />
          <span className="sr-only">Search restaurants</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Restaurant, cuisine, or neighbourhood"
            maxLength={100}
          />
        </label>
        <div className="filter-grid">
          <label>
            City
            <select name="city" defaultValue={filters.city || ""}>
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </label>
          <label>
            Area
            <input
              name="area"
              defaultValue={filters.area}
              placeholder="e.g. Karte Seh"
              maxLength={100}
            />
          </label>
          <label>
            Cuisine
            <select name="cuisine" defaultValue={filters.cuisine || ""}>
              <option value="">All cuisines</option>
              {cuisines.map((cuisine) => (
                <option key={cuisine}>{cuisine}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-checks">
          <label className="filter-check">
            <input
              type="checkbox"
              name="open"
              value="1"
              defaultChecked={filters.open}
            />{" "}
            Open now
          </label>
          <label className="filter-check">
            <input
              type="checkbox"
              name="delivery"
              value="1"
              defaultChecked={filters.delivery}
            />{" "}
            Delivery
          </label>
          <label className="filter-check">
            <input
              type="checkbox"
              name="pickup"
              value="1"
              defaultChecked={filters.pickup}
            />{" "}
            Pickup
          </label>
        </div>
        <div className="row wrap search-actions">
          <button>
            <Filter size={17} /> Show results
          </button>
          {filtered && (
            <Link className="button secondary" href="/explore">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <div className="results-heading row spread wrap">
        <div>
          <p className="eyebrow">RESULTS</p>
          <h2>
            {results.length} restaurant{results.length === 1 ? "" : "s"}
          </h2>
        </div>
        <span className="muted small">
          Meal search becomes active with menus in Phase 4.
        </span>
      </div>
      {results.length ? (
        <div className="explore-grid">
          {results.map((item) => {
            const cover = item.images.find((image) => image.kind === "cover");
            const logo = item.images.find((image) => image.kind === "logo");
            return (
              <article className="discovery-card" key={item.id}>
                <Link
                  className="discovery-cover"
                  href={`/restaurants/${item.slug}`}
                >
                  {cover ? (
                    <img
                      src={`/api/media/${cover.id}`}
                      alt={`${item.name} restaurant`}
                    />
                  ) : (
                    <span>
                      <Store size={40} />
                      <small>{item.cuisine}</small>
                    </span>
                  )}
                  <span
                    className={`open-badge ${item.isOpen ? "open" : "closed"}`}
                  >
                    <Clock3 size={14} /> {item.isOpen ? "Open now" : "Closed"}
                  </span>
                </Link>
                <div className="discovery-card-body">
                  <div className="restaurant-title-row">
                    <span className="result-logo">
                      {logo ? (
                        <img src={`/api/media/${logo.id}`} alt="" />
                      ) : (
                        <Store size={20} />
                      )}
                    </span>
                    <div>
                      <Link href={`/restaurants/${item.slug}`}>
                        <h2>{item.name}</h2>
                      </Link>
                      <p className="muted small">
                        <MapPin size={14} /> {item.area}, {item.city}
                      </p>
                    </div>
                  </div>
                  <p className="clamp">{item.description}</p>
                  <div className="service-pills">
                    <span>{item.cuisine}</span>
                    {item.deliveryAvailable && (
                      <span>
                        <Bike size={14} /> Delivery
                      </span>
                    )}
                    {item.pickupAvailable && <span>Pickup</span>}
                  </div>
                  <div className="row spread wrap card-footer-actions">
                    <FollowButton
                      restaurantId={item.id}
                      initial={item.following}
                      count={item.followerCount}
                      signedIn={Boolean(actor)}
                      compact
                    />
                    <Link
                      className="text-link"
                      href={`/restaurants/${item.slug}`}
                    >
                      View page <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="no-results">
          <span>
            <Search size={28} />
          </span>
          <h2>No restaurants match these filters.</h2>
          <p className="muted">
            Try a different city, remove a service filter, or clear the search.
          </p>
          <Link className="button" href="/explore">
            Clear all filters
          </Link>
        </section>
      )}
    </div>
  );
}
