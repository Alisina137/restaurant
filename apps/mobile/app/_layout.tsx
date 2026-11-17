import { Stack } from "expo-router";
import {SafeAreaProvider} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LocaleProvider } from "../src/locale";
import { theme } from "../src/theme";
export default function RootLayout() {
  return <SafeAreaProvider><LocaleProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }} />
  </LocaleProvider></SafeAreaProvider>;
}
