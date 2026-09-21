import Link from "next/link";
import { Heart, Store, Utensils } from "lucide-react";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { savedCollection } from "@/features/customers/service";
import { formatMoney } from "@/features/orders/money";
import { Empty, Title } from "@/components/ui";
import { FavoriteButton, SavedMealButton } from "@/components/customer-actions";

export default async function SavedPage() {
  const actor = await pageUser();
  const saved = await savedCollection(runtime().db, actor);
  return (
    <>
      <Title eyebrow="YOUR SHORTLIST" title="Food worth coming back to.">
        <p>
          Favorite restaurants and save individual meals for faster decisions.
        </p>
      </Title>
      {!saved.restaurants.length && !saved.meals.length ? (
        <Empty title="Nothing saved yet.">
          <p>
            Explore local kitchens and save the places and meals you want to
            try.
          </p>
          <Link className="button" href="/explore">
            Explore restaurants
          </Link>
        </Empty>
      ) : (
        <div className="stack saved-sections">
          <section>
            <div className="section-title-line">
              <div>
                <p className="eyebrow">FAVORITES</p>
                <h2>Restaurants</h2>
              </div>
              <Heart size={22} />
            </div>
            <div className="saved-restaurant-grid">
              {saved.restaurants.map((place) => (
                <article className="saved-restaurant-card" key={place.id}>
                  <Link
                    href={`/restaurants/${place.slug}`}
                    className="saved-place-main"
                  >
                    <span className="restaurant-avatar large">
                      {place.logoId ? (
                        <img
                          src={`/api/media/${place.logoId}`}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <Store size={24} />
                      )}
                    </span>
                    <span>
                      <strong>{place.name}</strong>
                      <small>
                        {place.cuisine} · {place.area}, {place.city}
                      </small>
                    </span>
                  </Link>
                  <FavoriteButton restaurantId={place.id} initial signedIn />
                </article>
              ))}
            </div>
          </section>
          <section>
            <div className="section-title-line">
              <div>
                <p className="eyebrow">SAVED MEALS</p>
                <h2>Ready for your next order</h2>
              </div>
              <Utensils size={22} />
            </div>
            <div className="saved-meal-grid">
              {saved.meals.map((dish) => (
                <article className="saved-meal-card" key={dish.id}>
                  <Link href={`/restaurants/${dish.restaurantSlug}#menu`}>
                    <span className="saved-meal-image">
                      {dish.imageKey ? (
                        <img
                          src={`/api/meal-media/${dish.id}`}
                          alt={dish.name}
                          loading="lazy"
                        />
                      ) : (
                        <Utensils size={28} />
                      )}
                    </span>
                    <span>
                      <small>{dish.restaurantName}</small>
                      <strong>{dish.name}</strong>
                      <p>{dish.description}</p>
                      <b>{formatMoney(dish.priceMinor)}</b>
                    </span>
                  </Link>
                  <SavedMealButton mealId={dish.id} initial signedIn compact />
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
