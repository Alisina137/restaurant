import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { direction, t } from "@dineflow/shared";
import { useLocale } from "../../src/locale";
import { authClient } from "../../src/auth-client";
import { theme } from "../../src/theme";
export default function More() {
  const { locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const rtl = direction(locale) === "rtl";
  async function signOut() {
    setBusy(true);
    try { await authClient.signOut(); router.replace("/sign-in"); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.root}>
    <Text style={[styles.title, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "more")}</Text>
    <Pressable onPress={() => router.push("/profile")} accessibilityRole="button" style={[styles.row, { flexDirection: rtl ? "row-reverse" : "row" }]}>
      <Ionicons name="person-circle-outline" size={25} color={theme.brand} /><Text style={styles.label}>{t(locale, "profile")}</Text><Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={20} color={theme.muted} />
    </Pressable>
    <Pressable onPress={() => void signOut()} disabled={busy} accessibilityRole="button" style={[styles.row, { flexDirection: rtl ? "row-reverse" : "row" }]}>
      <Ionicons name="log-out-outline" size={25} color={theme.danger} /><Text style={[styles.label, { color: theme.danger }]}>{t(locale, "signOut")}</Text>{busy && <ActivityIndicator color={theme.danger} />}
    </Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  root: { flexGrow: 1, paddingTop: 65, paddingHorizontal: 19, gap: 14, backgroundColor: theme.background },
  title: { fontSize: 27, fontWeight: "800", color: theme.ink, marginBottom: 17 },
  row: { backgroundColor: "white", borderWidth: 1, borderColor: theme.border, borderRadius: 15, padding: 17, alignItems: "center", gap: 13 },
  label: { flex: 1, color: theme.ink, fontSize: 15, fontWeight: "700" }
});
