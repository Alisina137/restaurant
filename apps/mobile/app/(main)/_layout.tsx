import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { t } from "@dineflow/shared";
import { useLocale } from "../../src/locale";
import { theme } from "../../src/theme";
export default function MainLayout() {
  const { locale } = useLocale();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.brand, tabBarInactiveTintColor: theme.muted,
    tabBarStyle: { height: 64, paddingTop: 7, backgroundColor: theme.surface, borderTopColor: theme.border }, tabBarLabelStyle: { fontSize: 12, fontWeight: "700", paddingBottom: 4 } }}>
    <Tabs.Screen name="home" options={{ title: t(locale, "home"), tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="more" options={{ title: t(locale, "more"), tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} /> }} />
  </Tabs>;
}
