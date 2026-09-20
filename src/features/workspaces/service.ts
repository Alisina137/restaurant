import "server-only";

import { cookies } from "next/headers";
import { and, count, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import {
  membership,
  order,
  report,
  restaurant,
  restaurantRevision,
} from "@/db/schema";
import type { Actor } from "@/lib/session";

export type RestaurantWorkspace = {
  kind: "restaurant";
  key: string;
  restaurantId: string;
  name: string;
  role: "owner" | "staff";
  preset: "manager" | "kitchen" | "content_editor" | "custom" | null;
  permissions: {
    orders: boolean;
    menu: boolean;
    menuContent: boolean;
    posts: boolean;
    delivery: boolean;
    availability: boolean;
    deliveryAddresses: boolean;
  };
};

export type ActiveWorkspace =
  | { kind: "personal"; key: "personal"; name: string }
  | { kind: "admin"; key: "admin"; name: string }
  | RestaurantWorkspace;

function restaurantWorkspace(
  row: typeof membership.$inferSelect & {
    restaurantName: string;
  },
): RestaurantWorkspace {
  const owner = row.role === "owner";
  return {
    kind: "restaurant",
    key: `restaurant:${row.restaurantId}`,
    restaurantId: row.restaurantId,
    name: row.restaurantName,
    role: row.role,
    preset: row.permissionPreset,
    permissions: {
      orders: owner || row.canManageOrders,
      menu: owner || row.canManageMenu,
      menuContent: owner || row.canEditMenuContent,
      posts: owner || row.canManagePosts,
      delivery: owner || row.canManageDelivery,
      availability: owner || row.canManageAvailability,
      deliveryAddresses: owner || row.canViewDeliveryAddresses,
    },
  };
}

export async function workspaceContext(db: Database, actor: Actor | null) {
  if (!actor)
    return {
      active: { kind: "personal", key: "personal", name: "Guest" } as const,
      workspaces: [] as RestaurantWorkspace[],
      badges: { personal: 0, restaurant: 0, admin: 0 },
    };

  const rows = await db
    .select({
      id: membership.id,
      restaurantId: membership.restaurantId,
      userId: membership.userId,
      role: membership.role,
      permissionPreset: membership.permissionPreset,
      canManageOrders: membership.canManageOrders,
      canManageMenu: membership.canManageMenu,
      canEditMenuContent: membership.canEditMenuContent,
      canManagePosts: membership.canManagePosts,
      canManageDelivery: membership.canManageDelivery,
      canManageAvailability: membership.canManageAvailability,
      canViewDeliveryAddresses: membership.canViewDeliveryAddresses,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      restaurantName: restaurant.name,
    })
    .from(membership)
    .innerJoin(restaurant, eq(restaurant.id, membership.restaurantId))
    .where(eq(membership.userId, actor.id));
  const workspaces = rows.map(restaurantWorkspace);
  const requested = (await cookies()).get("active_workspace")?.value;
  const active: ActiveWorkspace =
    requested === "admin" && actor.isAdmin
      ? { kind: "admin", key: "admin", name: "Platform admin" }
      : workspaces.find((item) => item.key === requested) || {
          kind: "personal",
          key: "personal",
          name: actor.name,
        };

  const activeStatuses = [
    "awaiting_acceptance",
    "accepted",
    "preparing",
    "out_for_delivery",
    "ready_for_pickup",
  ] as const;
  const personalCount = await db
    .select({ value: count() })
    .from(order)
    .where(
      and(
        eq(order.customerId, actor.id),
        inArray(order.status, [...activeStatuses]),
      ),
    )
    .then((value) => Number(value[0]?.value || 0));
  const restaurantCount =
    active.kind === "restaurant" && active.permissions.orders
      ? await db
          .select({ value: count() })
          .from(order)
          .where(
            and(
              eq(order.restaurantId, active.restaurantId),
              eq(order.status, "awaiting_acceptance"),
            ),
          )
          .then((value) => Number(value[0]?.value || 0))
      : 0;
  const adminCount = actor.isAdmin
    ? await Promise.all([
        db
          .select({ value: count() })
          .from(restaurant)
          .where(eq(restaurant.status, "pending_review")),
        db
          .select({ value: count() })
          .from(restaurantRevision)
          .where(eq(restaurantRevision.status, "pending_review")),
        db
          .select({ value: count() })
          .from(report)
          .where(eq(report.status, "open")),
      ]).then(
        ([restaurants, revisions, reports]) =>
          Number(restaurants[0]?.value || 0) +
          Number(revisions[0]?.value || 0) +
          Number(reports[0]?.value || 0),
      )
    : 0;
  return {
    active,
    workspaces,
    badges: {
      personal: personalCount,
      restaurant: restaurantCount,
      admin: adminCount,
    },
  };
}
