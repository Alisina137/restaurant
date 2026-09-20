"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CirclePlus, Pencil, Power, Utensils } from "lucide-react";
import { requestJson } from "./restaurant-form";
import { formatMoney } from "@/features/orders/money";

type Variant = { name: string; priceMinor: number; available: boolean };
type Option = { name: string; priceMinor: number; available: boolean };
type ExtraGroup = {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: Option[];
};
type Meal = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceMinor: number;
  imageKey: string | null;
  available: boolean;
  featured: boolean;
  sortOrder: number;
  variants: Variant[];
  extraGroups: ExtraGroup[];
};
type Category = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
  meals: Meal[];
};

const afn = (minor: number) => String(minor / 100);
const minor = (value: FormDataEntryValue | null) =>
  Math.round(Number(value || 0) * 100);

export function CatalogManager({
  restaurantId,
  acceptingOrders,
  approved,
  categories,
}: {
  restaurantId: string;
  acceptingOrders: boolean;
  approved: boolean;
  categories: Category[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Meal | null>(null);
  const [showMeal, setShowMeal] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [groups, setGroups] = useState<ExtraGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      setEditing(null);
      setShowMeal(false);
      setVariants([]);
      setGroups([]);
      router.refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function edit(meal: Meal) {
    setEditing(meal);
    setVariants(meal.variants.map((item) => ({ ...item })));
    setGroups(
      meal.extraGroups.map((group) => ({
        ...group,
        options: group.options.map((item) => ({ ...item })),
      })),
    );
    setShowMeal(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function upload(mealId: string, file: File) {
    if (!file.size) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/owner/restaurants/${restaurantId}/meals/${mealId}/media`,
        { method: "POST", headers: { "Content-Type": file.type }, body: file },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack catalog-manager">
      <section className="ordering-switch-card">
        <div>
          <p className="eyebrow">LIVE ORDERING</p>
          <h2>
            {acceptingOrders
              ? "Your kitchen is taking orders"
              : "Ordering is paused"}
          </h2>
          <p className="muted small">
            Menu changes publish immediately. Use this switch when the kitchen
            is ready.
          </p>
        </div>
        <button
          className={acceptingOrders ? "secondary" : ""}
          disabled={!approved || busy}
          onClick={() =>
            run(() =>
              requestJson(
                `/api/v1/owner/restaurants/${restaurantId}/ordering`,
                "PATCH",
                {
                  acceptingOrders: !acceptingOrders,
                },
              ),
            )
          }
        >
          <Power size={17} />{" "}
          {acceptingOrders ? "Pause orders" : "Start taking orders"}
        </button>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="owner-catalog-grid">
        <section className="card content-card stack">
          <div className="row spread wrap">
            <div>
              <p className="eyebrow">MENU STRUCTURE</p>
              <h2>Categories</h2>
            </div>
            <span className="count-badge">{categories.length}</span>
          </div>
          <form
            className="compact-create-row"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              void run(async () => {
                await requestJson(
                  `/api/v1/owner/restaurants/${restaurantId}/categories`,
                  "POST",
                  {
                    name: data.get("name"),
                    description: "",
                    sortOrder: categories.length,
                    active: true,
                  },
                );
                form.reset();
              });
            }}
          >
            <input
              name="name"
              placeholder="e.g. Afghan favourites"
              minLength={2}
              maxLength={80}
              required
            />
            <button disabled={busy}>
              <CirclePlus size={17} /> Add
            </button>
          </form>
          {categories.map((category) => (
            <div className="category-line" key={category.id}>
              <span>
                <strong>{category.name}</strong>
                <small>{category.meals.length} meals</small>
              </span>
              <span
                className={
                  category.active ? "availability-dot on" : "availability-dot"
                }
              />
            </div>
          ))}
          {!categories.length && (
            <p className="muted">Add a category before creating meals.</p>
          )}
        </section>

        <section className="card content-card stack meal-builder-panel">
          <div className="row spread wrap">
            <div>
              <p className="eyebrow">DISH BUILDER</p>
              <h2>{editing ? `Edit ${editing.name}` : "Create a meal"}</h2>
            </div>
            {!showMeal && (
              <button
                disabled={!categories.length}
                onClick={() => setShowMeal(true)}
              >
                <CirclePlus size={17} /> New meal
              </button>
            )}
          </div>
          {showMeal ? (
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const body = {
                  categoryId: data.get("categoryId"),
                  name: data.get("name"),
                  description: data.get("description"),
                  priceMinor: minor(data.get("price")),
                  available: data.get("available") === "on",
                  featured: data.get("featured") === "on",
                  sortOrder: editing?.sortOrder || 0,
                  variants,
                  extraGroups: groups,
                };
                void run(() =>
                  requestJson(
                    editing
                      ? `/api/v1/owner/restaurants/${restaurantId}/meals/${editing.id}`
                      : `/api/v1/owner/restaurants/${restaurantId}/meals`,
                    editing ? "PATCH" : "POST",
                    body,
                  ),
                );
              }}
            >
              <div className="form-grid">
                <label>
                  Category
                  <select
                    name="categoryId"
                    defaultValue={editing?.categoryId}
                    required
                  >
                    {categories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Meal name
                  <input
                    name="name"
                    defaultValue={editing?.name}
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </label>
              </div>
              <label>
                Description
                <textarea
                  name="description"
                  defaultValue={editing?.description}
                  maxLength={800}
                  rows={3}
                />
              </label>
              <div className="form-grid">
                <label>
                  Base price (AFN)
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={editing ? afn(editing.priceMinor) : ""}
                    required
                  />
                </label>
                <div className="inline-checks">
                  <label className="check">
                    <input
                      name="available"
                      type="checkbox"
                      defaultChecked={editing?.available ?? true}
                    />{" "}
                    Available
                  </label>
                  <label className="check">
                    <input
                      name="featured"
                      type="checkbox"
                      defaultChecked={editing?.featured}
                    />{" "}
                    Featured
                  </label>
                </div>
              </div>

              <OptionEditor
                variants={variants}
                setVariants={setVariants}
                groups={groups}
                setGroups={setGroups}
              />

              <div className="row wrap">
                <button disabled={busy}>
                  {busy ? "Saving…" : editing ? "Save meal" : "Create meal"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setShowMeal(false);
                    setEditing(null);
                    setVariants([]);
                    setGroups([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="builder-empty">
              <Utensils size={30} />
              <p>Add prices, sizes and optional extras in one place.</p>
            </div>
          )}
        </section>
      </div>

      <section className="stack">
        <div className="section-title-line">
          <div>
            <p className="eyebrow">YOUR MENU</p>
            <h2>Meals customers can order</h2>
          </div>
        </div>
        <div className="owner-meal-grid">
          {categories.flatMap((category) =>
            category.meals.map((item) => (
              <article className="owner-meal-card" key={item.id}>
                <div className="owner-meal-photo">
                  {item.imageKey ? (
                    <img
                      src={`/api/meal-media/${item.id}?owner=1`}
                      alt={item.name}
                    />
                  ) : (
                    <Utensils size={30} />
                  )}
                  <label className="photo-chip">
                    <Camera size={15} /> Photo
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(item.id, file);
                      }}
                    />
                  </label>
                </div>
                <div className="stack meal-card-copy">
                  <div className="row spread">
                    <span className="small muted">{category.name}</span>
                    <span
                      className={
                        item.available
                          ? "availability-dot on"
                          : "availability-dot"
                      }
                    />
                  </div>
                  <div>
                    <h3>{item.name}</h3>
                    <p className="small muted clamp">
                      {item.description || "No description yet"}
                    </p>
                  </div>
                  <div className="row spread">
                    <strong>
                      {item.variants.length
                        ? `From ${formatMoney(Math.min(...item.variants.map((v) => v.priceMinor)))}`
                        : formatMoney(item.priceMinor)}
                    </strong>
                    <button
                      className="icon-button secondary"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => edit(item)}
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                </div>
              </article>
            )),
          )}
        </div>
        {!categories.some((category) => category.meals.length) && (
          <div className="empty-inline">
            <Utensils size={26} />
            <div>
              <h3>Your menu is ready for its first meal.</h3>
              <p className="muted">
                Create a category, then add the food customers love.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function OptionEditor({
  variants,
  setVariants,
  groups,
  setGroups,
}: {
  variants: Variant[];
  setVariants: (value: Variant[]) => void;
  groups: ExtraGroup[];
  setGroups: (value: ExtraGroup[]) => void;
}) {
  return (
    <div className="configuration-grid">
      <section className="option-editor stack">
        <div className="row spread">
          <div>
            <h3>Sizes or variants</h3>
            <p className="small muted">
              Optional. Variant prices replace the base price.
            </p>
          </div>
          <button
            type="button"
            className="small-button secondary"
            onClick={() =>
              setVariants([
                ...variants,
                { name: "", priceMinor: 0, available: true },
              ])
            }
          >
            Add size
          </button>
        </div>
        {variants.map((variant, index) => (
          <div className="option-row" key={index}>
            <input
              aria-label="Variant name"
              placeholder="Large"
              value={variant.name}
              onChange={(event) =>
                setVariants(
                  variants.map((item, i) =>
                    i === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
              required
            />
            <input
              aria-label="Variant price AFN"
              type="number"
              min="0"
              placeholder="650 AFN"
              value={variant.priceMinor / 100 || ""}
              onChange={(event) =>
                setVariants(
                  variants.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          priceMinor: Math.round(
                            Number(event.target.value) * 100,
                          ),
                        }
                      : item,
                  ),
                )
              }
              required
            />
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setVariants(variants.filter((_, i) => i !== index))
              }
            >
              Remove
            </button>
          </div>
        ))}
      </section>
      <section className="option-editor stack">
        <div className="row spread">
          <div>
            <h3>Extra groups</h3>
            <p className="small muted">Sauces, toppings, sides and more.</p>
          </div>
          <button
            type="button"
            className="small-button secondary"
            onClick={() =>
              setGroups([
                ...groups,
                {
                  name: "",
                  minSelect: 0,
                  maxSelect: 1,
                  options: [{ name: "", priceMinor: 0, available: true }],
                },
              ])
            }
          >
            Add group
          </button>
        </div>
        {groups.map((group, groupIndex) => (
          <div className="extra-group-editor stack" key={groupIndex}>
            <input
              aria-label="Extra group name"
              placeholder="Choose a sauce"
              value={group.name}
              onChange={(event) =>
                setGroups(
                  groups.map((item, i) =>
                    i === groupIndex
                      ? { ...item, name: event.target.value }
                      : item,
                  ),
                )
              }
              required
            />
            <div className="option-limits">
              <label>
                Minimum
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={group.minSelect}
                  onChange={(event) =>
                    setGroups(
                      groups.map((item, i) =>
                        i === groupIndex
                          ? { ...item, minSelect: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Maximum
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={group.maxSelect}
                  onChange={(event) =>
                    setGroups(
                      groups.map((item, i) =>
                        i === groupIndex
                          ? { ...item, maxSelect: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            </div>
            {group.options.map((option, optionIndex) => (
              <div className="option-row" key={optionIndex}>
                <input
                  aria-label="Extra name"
                  placeholder="Garlic sauce"
                  value={option.name}
                  onChange={(event) =>
                    setGroups(
                      groups.map((item, i) =>
                        i === groupIndex
                          ? {
                              ...item,
                              options: item.options.map((value, j) =>
                                j === optionIndex
                                  ? { ...value, name: event.target.value }
                                  : value,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                  required
                />
                <input
                  aria-label="Extra price AFN"
                  type="number"
                  min="0"
                  value={option.priceMinor / 100 || ""}
                  onChange={(event) =>
                    setGroups(
                      groups.map((item, i) =>
                        i === groupIndex
                          ? {
                              ...item,
                              options: item.options.map((value, j) =>
                                j === optionIndex
                                  ? {
                                      ...value,
                                      priceMinor: Math.round(
                                        Number(event.target.value) * 100,
                                      ),
                                    }
                                  : value,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setGroups(
                      groups.map((item, i) =>
                        i === groupIndex
                          ? {
                              ...item,
                              options: item.options.filter(
                                (_, j) => j !== optionIndex,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <div className="row wrap">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setGroups(
                    groups.map((item, i) =>
                      i === groupIndex
                        ? {
                            ...item,
                            options: [
                              ...item.options,
                              { name: "", priceMinor: 0, available: true },
                            ],
                          }
                        : item,
                    ),
                  )
                }
              >
                + Add option
              </button>
              <button
                type="button"
                className="text-button danger-text"
                onClick={() =>
                  setGroups(groups.filter((_, i) => i !== groupIndex))
                }
              >
                Remove group
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
