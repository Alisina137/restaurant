import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { authClient } from "../src/auth-client";
import { theme } from "../src/theme";
export default function Index() {
  const { data, isPending } = authClient.useSession();
  useEffect(() => {
    if (!isPending) router.replace(data ? "/(main)/home" : "/sign-in");
  }, [data, isPending]);
  return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={theme.brand} size="large" /></View>;
}
