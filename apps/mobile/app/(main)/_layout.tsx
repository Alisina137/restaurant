import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { t } from "@dineflow/shared";
import { useLocale } from "../../src/locale";
import { theme } from "../../src/theme";
import { f } from "../../src/floor";
import {useReadyAlertBadge} from "../../src/use-ready-alert-badge";
import { o5 } from "../../src/order-copy";
export default function MainLayout() {
  const { locale } = useLocale();
  const unread=useReadyAlertBadge();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.brand, tabBarInactiveTintColor: theme.muted,
    tabBarStyle: { height: 64, paddingTop: 7, backgroundColor: theme.surface, borderTopColor: theme.border }, tabBarLabelStyle: { fontSize: 12, fontWeight: "700", paddingBottom: 4 } }}>
    <Tabs.Screen name="home" options={{ title: t(locale, "home"), tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="tables" options={{ title: f(locale, "tables"), tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="orders" options={{ title: o5(locale, "orders"), tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="menu" options={{ title: o5(locale, "menu"), tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size} color={color} /> }} />
    <Tabs.Screen name="more" options={{ title: t(locale, "more"), tabBarBadge:unread&&unread>0?(unread>99?"99+":unread):undefined, tabBarBadgeStyle:{backgroundColor:theme.brand,color:"white"}, tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} /> }} />
  </Tabs>;
}
