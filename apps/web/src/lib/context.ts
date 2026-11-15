import type { Locale, Role, StaffRole } from "@dineflow/shared";
import { API_URL } from "./auth-client";
export type WorkspaceContext = {
  user: { id: string; name: string; email: string };
  role: Role;
  locale: Locale;
  tenantId: string | null;
  tenantName: string | null;
  memberships: { tenantId: string; tenantName: string; role: StaffRole }[];
  defaultRoute: string;
};
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export async function api(path: string, init?: RequestInit): Promise<Response> {
  const result = await fetch(API_URL + path, { ...init, credentials: "include", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!result.ok) throw new ApiError(result.status, "Request failed (" + result.status + ")");
  return result;
}
export async function getContext(): Promise<WorkspaceContext> {
  const response = await api("/api/context");
  return response.json() as Promise<WorkspaceContext>;
}
