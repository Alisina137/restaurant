import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { direction, t } from "@dineflow/shared";
import { fetchIdentity, type Identity } from "../../src/api";
import { authClient } from "../../src/auth-client";
import { theme } from "../../src/theme";
import { useLocale } from "../../src/locale";
import { router } from "expo-router";
export default function Home() {
  const { locale, changeLocale } = useLocale();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const rtl = direction(locale) === "rtl";
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const data = await fetchIdentity();
      if (data.role !== "waiter") { setError("ACCESS"); setIdentity(null); return; }
      setIdentity(data);
      changeLocale(data.locale);
    } catch (e) {
      const message = String(e);
      if (message.includes("401")) { router.replace("/sign-in"); return; }
      setError(message.includes("403") ? "MEMBERSHIP" : "NETWORK");
    } finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <View style={[styles.header, { flexDirection: rtl ? "row-reverse" : "row" }]}>
      <View><Text style={[styles.small, { textAlign: rtl ? "right" : "left" }]}>DINEFLOW</Text><Text style={styles.headerTitle}>{t(locale, "home")}</Text></View>
      <View style={styles.roundIcon}><Ionicons name="restaurant-outline" color={theme.brand} size={25} /></View>
    </View>
    {busy ? <View style={styles.center}><ActivityIndicator color={theme.brand} size="large" /><Text style={styles.muted}>{t(locale, "loading")}</Text></View> :
      error ? <View style={styles.panel}><Text style={styles.title}>{error === "ACCESS" ? t(locale, "accessDenied") : error === "MEMBERSHIP" ? t(locale, "noMembership") : t(locale, "offline")}</Text>
        <Pressable onPress={() => void load()} style={styles.action}><Text style={styles.actionText}>{t(locale, "retry")}</Text></Pressable></View> :
      identity ? <>
        <View style={styles.hero}>
          <View style={[styles.heroBadge, { flexDirection: rtl ? "row-reverse" : "row" }]}><Ionicons name="shield-checkmark" size={15} color="#176D59" /><Text style={styles.heroBadgeText}>{t(locale, "active")}</Text></View>
          <Text style={[styles.title, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "welcome")}, {identity.user.name}</Text>
          <Text style={[styles.muted, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "readySubtitle")}</Text>
        </View>
        <View style={styles.panel}>
          <View style={[styles.panelRow, { flexDirection: rtl ? "row-reverse" : "row" }]}><Ionicons name="storefront-outline" color={theme.brand} size={23} /><Text style={styles.sectionTitle}>{t(locale, "restaurant")}</Text></View>
          <Text style={[styles.panelName, { textAlign: rtl ? "right" : "left" }]}>{identity.tenantName}</Text>
        </View>
        <View style={styles.panel}>
          <View style={[styles.panelRow, { flexDirection: rtl ? "row-reverse" : "row" }]}><Ionicons name="lock-closed-outline" color={theme.brand} size={23} /><Text style={styles.sectionTitle}>{t(locale, "secure")}</Text></View>
          <Text style={[styles.muted, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "secureBody")}</Text>
        </View>
      </> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  content: { padding: 19, paddingTop: 62, gap: 17, paddingBottom: 42 },
  header: { alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  small: { color: theme.brand, fontSize: 11, fontWeight: "900", letterSpacing: 1.6 },
  headerTitle: { fontSize: 27, fontWeight: "800", color: theme.ink },
  roundIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" },
  center: { paddingVertical: 66, gap: 14, alignItems: "center" },
  muted: { color: theme.muted, fontSize: 14, lineHeight: 23 },
  hero: { backgroundColor: "#E6F4EC", borderRadius: theme.radius, padding: 24, gap: 14, minHeight: 212 },
  heroBadge: { alignItems: "center", gap: 7, backgroundColor: "#FFFFFFAA", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, alignSelf: "flex-start" },
  heroBadgeText: { color: theme.brand, fontWeight: "800", fontSize: 12 },
  title: { color: theme.ink, fontSize: 25, fontWeight: "800", lineHeight: 36 },
  panel: { borderRadius: theme.radius, backgroundColor: "white", borderWidth: 1, borderColor: theme.border, padding: 21, gap: 13 },
  panelRow: { alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: theme.ink },
  panelName: { fontSize: 18, fontWeight: "700", color: theme.ink },
  action: { backgroundColor: theme.brand, padding: 15, alignItems: "center", borderRadius: 12 },
  actionText: { color: "white", fontWeight: "800" }
});
