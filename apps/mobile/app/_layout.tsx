import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LocaleProvider } from "../src/locale";
import { theme } from "../src/theme";
export default function RootLayout() {
  return <LocaleProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }} />
  </LocaleProvider>;
}
