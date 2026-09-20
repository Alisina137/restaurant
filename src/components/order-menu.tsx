"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Check, Minus, Plus, ShoppingBag, Store, X } from "lucide-react";
import { requestJson } from "./restaurant-form";
import { formatMoney } from "@/features/orders/money";
import { SavedMealButton } from "./customer-actions";

type Variant = { id: string; name: string; priceMinor: number };
type ExtraOption = { id: string; name: string; priceMinor: number };
type ExtraGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: ExtraOption[];
};
type Meal = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  imageKey: string | null;
  featured: boolean;
  saved: boolean;
  freshOffer: {
    id: string;
    specialPriceMinor: number | null;
    stockRemaining: number;
    endsAt: Date;
  } | null;
  variants: Variant[];
  extraGroups: ExtraGroup[];
};
type Category = { id: string; name: string; meals: Meal[] };
type Zone = {
  id: string;
  name: string;
  feeMinor: number;
  minimumMinor: number;
  etaMin: number;
  etaMax: number;
};
type CartItem = {
  key: string;
  meal: Meal;
  variantId?: string;
  extraOptionIds: string[];
  quantity: number;
};

function configuredPrice(
  meal: Meal,
  variantId?: string,
  optionIds: string[] = [],
) {
  const variant = meal.variants.find((item) => item.id === variantId);
  const extras = meal.extraGroups
    .flatMap((group) => group.options)
    .filter((item) => optionIds.includes(item.id));
  return (
    (meal.freshOffer?.specialPriceMinor ??
      variant?.priceMinor ??
      meal.priceMinor) + extras.reduce((sum, item) => sum + item.priceMinor, 0)
  );
}

export function OrderMenu({
  restaurant,
  categories,
  zones,
  signedIn,
  customerName,
  lowData,
  savedAddresses,
}: {
  restaurant: {
    id: string;
    name: string;
    acceptingOrders: boolean;
    deliveryAvailable: boolean;
    pickupAvailable: boolean;
    deliveryOrdersEnabled: boolean;
    pickupOrdersEnabled: boolean;
    kitchenState: "open" | "busy" | "paused";
    prepTimeMin: number;
    prepTimeMax: number;
    availabilityNote: string;
    availabilityUpdatedAt: Date;
  };
  categories: Category[];
  zones: Zone[];
  signedIn: boolean;
  customerName?: string;
  lowData: boolean;
  savedAddresses: SavedAddress[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null);
  const [variantId, setVariantId] = useState<string | undefined>();
  const [extras, setExtras] = useState<string[]>([]);
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    restaurant.deliveryAvailable && restaurant.deliveryOrdersEnabled
      ? "delivery"
      : "pickup",
  );
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          configuredPrice(item.meal, item.variantId, item.extraOptionIds) *
            item.quantity,
        0,
      ),
    [cart],
  );

  function openMeal(meal: Meal) {
    setActiveMeal(meal);
    setVariantId(meal.variants[0]?.id);
    setExtras([]);
    setError("");
  }
  function add() {
    if (!activeMeal) return;
    for (const group of activeMeal.extraGroups) {
      const count = group.options.filter((item) =>
        extras.includes(item.id),
      ).length;
      if (count < group.minSelect || count > group.maxSelect) {
        setError(
          `Choose ${group.minSelect}–${group.maxSelect} options for ${group.name}.`,
        );
        return;
      }
    }
    const key = `${activeMeal.id}:${variantId || "base"}:${[...extras].sort().join(",")}`;
    setCart((items) => {
      const found = items.find((item) => item.key === key);
      return found
        ? items.map((item) =>
            item.key === key ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [
            ...items,
            {
              key,
              meal: activeMeal,
              variantId,
              extraOptionIds: extras,
              quantity: 1,
            },
          ];
    });
    setActiveMeal(null);
    setError("");
  }
  function quantity(key: string, change: number) {
    setCart((items) =>
      items
        .map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  return (
    <section id="menu" className="ordering-section">
      <div className="section-title-line ordering-title">
        <div>
          <p className="eyebrow">ORDER ONLINE</p>
          <h2>Explore the menu</h2>
          <p className="muted">
            Prices are confirmed securely before your order is placed.
          </p>
          <p className="small muted">
            Estimated preparation: {restaurant.prepTimeMin}–
            {restaurant.prepTimeMax} min · Delivered by the restaurant.
          </p>
        </div>
        <span
          className={
            restaurant.acceptingOrders && restaurant.kitchenState !== "paused"
              ? `kitchen-state ${restaurant.kitchenState}`
              : "kitchen-state"
          }
        >
          {restaurant.acceptingOrders &&
          restaurant.kitchenState !== "paused" ? (
            <>
              <Check size={15} />{" "}
              {restaurant.kitchenState === "busy"
                ? "Busy · longer prep"
                : "Taking orders"}
            </>
          ) : (
            "Ordering paused"
          )}
        </span>
      </div>
      {restaurant.availabilityNote && (
        <p className="availability-note">{restaurant.availabilityNote}</p>
      )}
      {!categories.some((category) => category.meals.length) ? (
        <div className="empty-inline">
          <Store size={27} />
          <div>
            <h3>The menu is being prepared.</h3>
            <p className="muted">Check back soon for food from this kitchen.</p>
          </div>
        </div>
      ) : (
        <div className="menu-order-layout">
          <div className="menu-browser stack">
            <nav className="category-chips" aria-label="Menu categories">
              {categories
                .filter((category) => category.meals.length)
                .map((category) => (
                  <a href={`#category-${category.id}`} key={category.id}>
                    {category.name}
                  </a>
                ))}
            </nav>
            {categories.map((category) =>
              category.meals.length ? (
                <section
                  id={`category-${category.id}`}
                  className="menu-category"
                  key={category.id}
                >
                  <div className="category-heading">
                    <h3>{category.name}</h3>
                    <span>{category.meals.length} items</span>
                  </div>
                  <div className="customer-meal-grid">
                    {category.meals.map((meal) => (
                      <article className="customer-meal-card" key={meal.id}>
                        <button
                          className="meal-image-button"
                          onClick={() => openMeal(meal)}
                          aria-label={`Choose ${meal.name}`}
                        >
                          {meal.imageKey && !lowData ? (
                            <img
                              src={`/api/meal-media/${meal.id}`}
                              alt={meal.name}
                            />
                          ) : (
                            <span>
                              <Store size={28} />
                            </span>
                          )}
                          {meal.featured && <small>Popular</small>}
                          {meal.freshOffer && (
                            <small className="fresh-tag">
                              Fresh Today · {meal.freshOffer.stockRemaining}{" "}
                              left
                            </small>
                          )}
                        </button>
                        <div className="meal-info">
                          <SavedMealButton
                            mealId={meal.id}
                            initial={meal.saved}
                            signedIn={signedIn}
                            compact
                          />
                          <div>
                            <h3>{meal.name}</h3>
                            <p className="muted small clamp">
                              {meal.description ||
                                "Prepared by the restaurant kitchen."}
                            </p>
                          </div>
                          <div className="row spread">
                            <strong>
                              {meal.freshOffer?.specialPriceMinor
                                ? formatMoney(meal.freshOffer.specialPriceMinor)
                                : meal.variants.length
                                  ? `From ${formatMoney(Math.min(...meal.variants.map((item) => item.priceMinor)))}`
                                  : formatMoney(meal.priceMinor)}
                            </strong>
                            <button
                              className="round-add"
                              onClick={() => openMeal(meal)}
                              aria-label={`Add ${meal.name}`}
                              disabled={
                                !restaurant.acceptingOrders ||
                                restaurant.kitchenState === "paused"
                              }
                            >
                              <Plus size={19} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null,
            )}
          </div>

          <aside className="cart-panel">
            <div className="row spread">
              <div className="cart-heading">
                <ShoppingBag size={20} />
                <h3>Your order</h3>
              </div>
              <span className="count-badge">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </div>
            {!cart.length ? (
              <div className="cart-empty">
                <ShoppingBag size={29} />
                <p>Your selected meals will appear here.</p>
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cart.map((item) => {
                    const variant = item.meal.variants.find(
                      (value) => value.id === item.variantId,
                    );
                    return (
                      <div className="cart-line" key={item.key}>
                        <div>
                          <strong>{item.meal.name}</strong>
                          {variant && <small>{variant.name}</small>}
                          <small>
                            {formatMoney(
                              configuredPrice(
                                item.meal,
                                item.variantId,
                                item.extraOptionIds,
                              ),
                            )}
                          </small>
                        </div>
                        <div className="quantity-control">
                          <button
                            onClick={() => quantity(item.key, -1)}
                            aria-label="Remove one"
                          >
                            <Minus size={14} />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            onClick={() => quantity(item.key, 1)}
                            aria-label="Add one"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="cart-total">
                  <span>Food subtotal</span>
                  <strong>{formatMoney(subtotal)}</strong>
                </div>
                <button
                  disabled={
                    !restaurant.acceptingOrders ||
                    restaurant.kitchenState === "paused"
                  }
                  onClick={() => setCheckout(true)}
                >
                  Review order
                </button>
              </>
            )}
          </aside>
        </div>
      )}

      {activeMeal && (
        <div
          className="sheet-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveMeal(null);
          }}
        >
          <div
            className="meal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="meal-title"
          >
            <button
              className="sheet-close"
              onClick={() => setActiveMeal(null)}
              aria-label="Close"
            >
              <X />
            </button>
            {activeMeal.imageKey && !lowData && (
              <img
                className="sheet-meal-image"
                src={`/api/meal-media/${activeMeal.id}`}
                alt=""
              />
            )}
            <div className="stack sheet-content">
              <div>
                <p className="eyebrow">CUSTOMISE YOUR MEAL</p>
                <h2 id="meal-title">{activeMeal.name}</h2>
                <p className="muted">{activeMeal.description}</p>
              </div>
              {activeMeal.variants.length > 0 && (
                <fieldset>
                  <legend>
                    Choose a size <small>Required</small>
                  </legend>
                  {activeMeal.variants.map((variant) => (
                    <label className="choice-line" key={variant.id}>
                      <span>
                        <input
                          type="radio"
                          name="variant"
                          checked={variantId === variant.id}
                          onChange={() => setVariantId(variant.id)}
                        />{" "}
                        {variant.name}
                      </span>
                      <strong>{formatMoney(variant.priceMinor)}</strong>
                    </label>
                  ))}
                </fieldset>
              )}
              {activeMeal.extraGroups.map((group) => (
                <fieldset key={group.id}>
                  <legend>
                    {group.name}{" "}
                    <small>
                      {group.minSelect
                        ? `Choose ${group.minSelect}–${group.maxSelect}`
                        : `Up to ${group.maxSelect}`}
                    </small>
                  </legend>
                  {group.options.map((option) => (
                    <label className="choice-line" key={option.id}>
                      <span>
                        <input
                          type="checkbox"
                          checked={extras.includes(option.id)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              const current = group.options.filter((item) =>
                                extras.includes(item.id),
                              ).length;
                              if (current >= group.maxSelect) return;
                              setExtras([...extras, option.id]);
                            } else
                              setExtras(
                                extras.filter((id) => id !== option.id),
                              );
                          }}
                        />{" "}
                        {option.name}
                      </span>
                      <strong>
                        {option.priceMinor
                          ? `+ ${formatMoney(option.priceMinor)}`
                          : "Included"}
                      </strong>
                    </label>
                  ))}
                </fieldset>
              ))}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button onClick={add}>
                <Plus size={18} /> Add ·{" "}
                {formatMoney(configuredPrice(activeMeal, variantId, extras))}
              </button>
            </div>
          </div>
        </div>
      )}

      {checkout && (
        <CheckoutSheet
          restaurant={restaurant}
          cart={cart}
          subtotal={subtotal}
          zones={zones}
          fulfillment={fulfillment}
          setFulfillment={setFulfillment}
          signedIn={signedIn}
          customerName={customerName}
          savedAddresses={savedAddresses}
          busy={busy}
          error={error}
          close={() => {
            setCheckout(false);
            setError("");
          }}
          submit={async (form) => {
            setBusy(true);
            setError("");
            try {
              const data = new FormData(form);
              const address =
                fulfillment === "delivery"
                  ? {
                      recipient: data.get("recipient"),
                      phone: data.get("phone"),
                      city: data.get("city"),
                      area: data.get("area"),
                      address: data.get("address"),
                      instructions: data.get("instructions"),
                    }
                  : undefined;
              const quoted = await requestJson<{ id: string }>(
                "/api/v1/quotes",
                "POST",
                {
                  restaurantId: restaurant.id,
                  fulfillment,
                  deliveryZoneId:
                    fulfillment === "delivery" ? data.get("zone") : undefined,
                  address,
                  note: data.get("note"),
                  items: cart.map((item) => ({
                    mealId: item.meal.id,
                    offerId: item.meal.freshOffer?.id,
                    variantId: item.variantId,
                    extraOptionIds: item.extraOptionIds,
                    quantity: item.quantity,
                  })),
                },
              );
              await requestJson("/api/v1/orders", "POST", {
                quoteId: quoted.id,
                idempotencyKey: crypto.randomUUID(),
              });
              setCart([]);
              router.push("/orders?placed=1");
              router.refresh();
            } catch (reason) {
              setError((reason as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </section>
  );
}

function CheckoutSheet({
  restaurant,
  cart,
  subtotal,
  zones,
  fulfillment,
  setFulfillment,
  signedIn,
  customerName,
  savedAddresses,
  busy,
  error,
  close,
  submit,
}: {
  restaurant: {
    name: string;
    deliveryAvailable: boolean;
    pickupAvailable: boolean;
    deliveryOrdersEnabled: boolean;
    pickupOrdersEnabled: boolean;
  };
  cart: CartItem[];
  subtotal: number;
  zones: Zone[];
  fulfillment: "delivery" | "pickup";
  setFulfillment: (value: "delivery" | "pickup") => void;
  signedIn: boolean;
  customerName?: string;
  savedAddresses: SavedAddress[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (form: HTMLFormElement) => Promise<void>;
}) {
  return (
    <div className="sheet-backdrop checkout-backdrop">
      <div
        className="checkout-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <button className="sheet-close" onClick={close} aria-label="Close">
          <X />
        </button>
        <div className="stack sheet-content">
          <div>
            <p className="eyebrow">CHECKOUT</p>
            <h2 id="checkout-title">Order from {restaurant.name}</h2>
            <p className="muted">
              The restaurant will deliver using its own team.
            </p>
          </div>
          {!signedIn ? (
            <div className="signin-gate">
              <ShoppingBag size={29} />
              <h3>Sign in to place your order</h3>
              <p className="muted">
                Your cart will remain here while you sign in in this tab.
              </p>
              <Link className="button" href="/sign-in">
                Sign in
              </Link>
            </div>
          ) : (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void submit(event.currentTarget);
              }}
            >
              <div className="fulfillment-toggle">
                {restaurant.deliveryAvailable &&
                  restaurant.deliveryOrdersEnabled && (
                    <button
                      type="button"
                      className={fulfillment === "delivery" ? "selected" : ""}
                      onClick={() => setFulfillment("delivery")}
                    >
                      <Bike size={17} /> Delivery
                    </button>
                  )}
                {restaurant.pickupAvailable &&
                  restaurant.pickupOrdersEnabled && (
                    <button
                      type="button"
                      className={fulfillment === "pickup" ? "selected" : ""}
                      onClick={() => setFulfillment("pickup")}
                    >
                      <ShoppingBag size={17} /> Pickup
                    </button>
                  )}
              </div>
              {fulfillment === "delivery" && (
                <>
                  {savedAddresses.length > 0 && (
                    <label>
                      Saved address
                      <select
                        defaultValue=""
                        onChange={(event) => {
                          const selected = savedAddresses.find(
                            (item) => item.id === event.target.value,
                          );
                          const form = event.currentTarget.form;
                          if (!selected || !form) return;
                          for (const key of [
                            "recipient",
                            "phone",
                            "city",
                            "area",
                            "address",
                            "instructions",
                          ] as const) {
                            const control = form.elements.namedItem(key) as
                              HTMLInputElement | HTMLTextAreaElement | null;
                            if (control) control.value = selected[key];
                          }
                        }}
                      >
                        <option value="">Enter another address</option>
                        {savedAddresses.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.label} · {item.area}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Delivery area
                    <select name="zone" required>
                      <option value="">Choose your area</option>
                      {zones.map((zone) => (
                        <option value={zone.id} key={zone.id}>
                          {zone.name} · {formatMoney(zone.feeMinor)} ·{" "}
                          {zone.etaMin}–{zone.etaMax} min
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      Recipient
                      <input
                        name="recipient"
                        defaultValue={customerName}
                        minLength={2}
                        required
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        name="phone"
                        type="tel"
                        placeholder="+93700123456"
                        pattern="\+93[2-7][0-9]{8}"
                        required
                      />
                    </label>
                  </div>
                  <div className="form-grid">
                    <label>
                      City
                      <input name="city" defaultValue="Kabul" required />
                    </label>
                    <label>
                      Area
                      <input name="area" placeholder="Neighbourhood" required />
                    </label>
                  </div>
                  <label>
                    Street, house and landmark
                    <input name="address" minLength={5} required />
                  </label>
                  <label>
                    Delivery instructions
                    <textarea name="instructions" rows={2} maxLength={300} />
                  </label>
                </>
              )}
              <label>
                Note for the kitchen
                <textarea name="note" rows={2} maxLength={500} />
              </label>
              <div className="checkout-summary">
                <span>
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </span>
                <strong>Food subtotal {formatMoney(subtotal)}</strong>
                <small>
                  Final total includes the selected delivery fee and is
                  confirmed by the server.
                </small>
              </div>
              <div className="payment-note">
                <Check size={18} />
                <span>
                  <strong>Payment for Phase 4</strong>
                  <small>
                    Pay the restaurant on delivery or pickup. Secure HesabPay
                    checkout arrives in Phase 5.
                  </small>
                </span>
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <button disabled={busy}>
                {busy ? "Confirming price…" : "Place order"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

type SavedAddress = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  city: string;
  area: string;
  address: string;
  instructions: string;
};
