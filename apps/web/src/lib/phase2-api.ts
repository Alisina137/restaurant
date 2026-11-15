import { API_URL } from "./auth-client";
export class Phase2Error extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}
export async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_URL + path, { credentials: "include", cache: "no-store", ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({})) as { code?: string; message?: string };
  if (!response.ok) throw new Phase2Error(response.status, data.code ?? "REQUEST_FAILED",
    data.message ?? "Request failed. Please retry.");
  return data as T;
}
export type PageResult<T> = { items: T[]; total: number; page: number; perPage: number };
