import type { Locale, Role, StaffRole } from "@dineflow/shared";
import { API_URL, authClient } from "./auth-client";
import {observedFetch} from "./network-status";

export type Identity = {
  user: { id: string; name: string; email: string };
  locale: Locale; role: Role; tenantId: string | null; tenantName: string | null;
  defaultRoute: string; memberships: { tenantId: string; tenantName: string; role: StaffRole }[];
};
export async function authenticatedFetch(path: string, options?: RequestInit) {
  const cookie = await authClient.getCookie();
  const response = await observedFetch(API_URL + path, {
    ...options, credentials: "omit",
    headers: { Cookie: cookie ?? "", "Content-Type": "application/json", ...(options?.headers ?? {}) }
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response;
}
export async function fetchIdentity(): Promise<Identity> {
  const response = await authenticatedFetch("/api/context");
  return response.json() as Promise<Identity>;
}
