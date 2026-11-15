import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [expoClient({ scheme: "dineflow", storagePrefix: "dineflow", storage: SecureStore })]
});
