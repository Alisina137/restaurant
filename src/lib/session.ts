import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { configured } from "./env";
import { runtime } from "./runtime";
import { HttpError } from "./http";
export type Actor = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  isAdmin?: boolean;
};
export async function currentUser(): Promise<Actor | null> {
  if (!configured()) return null;
  return (
    (await runtime().auth.api.getSession({ headers: await headers() }))?.user ??
    null
  );
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in to continue.");
  return user;
}
export async function pageUser() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}
