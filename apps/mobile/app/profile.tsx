import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { direction, t, type Locale } from "@dineflow/shared";
import { authenticatedFetch, fetchIdentity, type Identity } from "../src/api";
import { useLocale } from "../src/locale";
import { theme } from "../src/theme";
export default function Profile() {
  const { locale, changeLocale } = useLocale();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rtl = direction(locale) === "rtl";
  useEffect(() => {
    fetchIdentity().then(setIdentity).catch(() => setError(t(locale, "offline")));
  }, []);
  async function updateLocale(value: Locale) {
    setBusy(true); setError("");
    try {
      await authenticatedFetch("/api/preferences/locale", { method: "PUT", body: JSON.stringify({ locale: value }) });
      changeLocale(value);
    } catch { setError(t(locale, "offline")); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.root}>
    <Pressable onPress={() => router.back()} accessibilityRole="button" style={[styles.back, { flexDirection: rtl ? "row-reverse" : "row" }]}><Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={22} color={theme.brand} /><Text style={styles.backText}>{t(locale, "more")}</Text></Pressable>
    <Text style={[styles.title, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "profile")}</Text>
    <View style={styles.card}>
      <Text style={styles.secondary}>{t(locale, "profile")}</Text>
      {identity ? <><Text style={styles.name}>{identity.user.name}</Text><Text style={[styles.secondary, { writingDirection: "ltr" }]}>{identity.user.email}</Text></> : <ActivityIndicator color={theme.brand} />}
    </View>
    <View style={styles.card}>
      <Text style={styles.section}>{t(locale, "language")}</Text>
      {(["fa-AF", "ps-AF", "en"] as const).map((value) => <Pressable key={value} disabled={busy} onPress={() => void updateLocale(value)} accessibilityRole="radio" accessibilityState={{ checked: value === locale }}
          style={[styles.localeRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <Text style={styles.localeLabel}>{value === "fa-AF" ? "دری" : value === "ps-AF" ? "پښتو" : "English"}</Text>
        <Ionicons name={value === locale ? "radio-button-on" : "radio-button-off"} size={22} color={value === locale ? theme.brand : theme.muted} />
      </Pressable>)}
      {busy && <ActivityIndicator color={theme.brand} />}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  root: { padding: 19, paddingTop: 58, backgroundColor: theme.background, flexGrow: 1, gap: 18 },
  back: { alignItems: "center", gap: 8, marginBottom: 6 }, backText: { fontSize: 14, color: theme.brand, fontWeight: "700" },
  title: { fontSize: 27, fontWeight: "800", color: theme.ink },
  card: { padding: 21, borderRadius: theme.radius, backgroundColor: "white", borderWidth: 1, borderColor: theme.border, gap: 11 },
  secondary: { color: theme.muted, fontSize: 14 },
  name: { color: theme.ink, fontSize: 20, fontWeight: "800" },
  section: { color: theme.ink, fontSize: 18, fontWeight: "800", marginBottom: 5 },
  localeRow: { alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomColor: theme.border, borderBottomWidth: 1, minHeight: 48 },
  localeLabel: { color: theme.ink, fontWeight: "700", fontSize: 15 },
  error: { color: theme.danger }
});
