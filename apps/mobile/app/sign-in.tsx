import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { direction, t, type Locale } from "@dineflow/shared";
import { authClient } from "../src/auth-client";
import { theme } from "../src/theme";
import { useLocale } from "../src/locale";

export default function SignIn() {
  const { locale, changeLocale } = useLocale();
  const rtl = direction(locale) === "rtl";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (!email.includes("@") || password.length < 8 || busy) return;
    setBusy(true); setError("");
    try {
      const result = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (result.error) { setError(t(locale, "invalidLogin")); return; }
      router.replace("/(main)/home");
    } catch { setError(t(locale, "offline")); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.root}>
      <View style={styles.topAccent}><View style={styles.logo}><Text style={styles.logoText}>D</Text></View><Text style={styles.brand}>DineFlow</Text>
        <Text style={styles.topDescription}>RESTAURANT OPERATIONS</Text></View>
      <View style={styles.sheet}>
        <Text style={[styles.title, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "welcome")}</Text>
        <Text style={[styles.subtitle, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "signInHelp")}</Text>
        <View style={[styles.localeRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          {(["fa-AF", "ps-AF", "en"] as const).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: locale === item }} onPress={() => changeLocale(item)} style={[styles.localeChip, locale === item && styles.localeSelected]}>
            <Text style={[styles.localeChipText, locale === item && styles.localeSelectedText]}>{item === "fa-AF" ? "دری" : item === "ps-AF" ? "پښتو" : "English"}</Text>
          </Pressable>)}
        </View>
        <Text style={[styles.label, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "email")}</Text>
        <TextInput style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} placeholder="staff@example.com" accessibilityLabel={t(locale, "email")} textAlign="left" />
        <Text style={[styles.label, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "password")}</Text>
        <TextInput style={styles.input} secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} accessibilityLabel={t(locale, "password")} textAlign="left" />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={busy || !email.includes("@") || password.length < 8} onPress={() => void submit()} style={[styles.button, (busy || !email.includes("@") || password.length < 8) && styles.disabled]}>
          {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{t(locale, "signIn")}</Text>}
        </Pressable>
        <Text style={styles.tip}>{t(locale, "support")}</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  root: { flexGrow: 1, backgroundColor: theme.background },
  topAccent: { minHeight: 240, backgroundColor: theme.brand, paddingTop: 76, alignItems: "center", justifyContent: "center" },
  logo: { width: 64, height: 64, borderRadius: 22, backgroundColor: theme.gold, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 34, fontWeight: "900", color: theme.brandDark },
  brand: { color: "white", fontSize: 27, fontWeight: "800", marginTop: 11 },
  topDescription: { color: "#B4DFD2", fontSize: 10, letterSpacing: 1.6, fontWeight: "700", marginTop: 5 },
  sheet: { backgroundColor: "white", borderTopLeftRadius: 29, borderTopRightRadius: 29, marginTop: -20, padding: 26, paddingTop: 34, flex: 1 },
  title: { color: theme.ink, fontSize: 29, fontWeight: "800", marginBottom: 7 },
  subtitle: { color: theme.muted, fontSize: 14, lineHeight: 23, marginBottom: 24 },
  localeRow: { gap: 8, marginBottom: 27 },
  localeChip: { borderRadius: 22, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  localeSelected: { backgroundColor: theme.brandSoft, borderColor: theme.brand },
  localeChipText: { fontWeight: "600", fontSize: 12, color: theme.muted },
  localeSelectedText: { color: theme.brand },
  label: { color: theme.ink, fontWeight: "700", marginBottom: 9, fontSize: 14 },
  input: { borderColor: theme.border, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, height: 51, marginBottom: 20, fontSize: 15, color: theme.ink, backgroundColor: "#fff" },
  error: { color: theme.danger, paddingVertical: 8 },
  button: { backgroundColor: theme.brand, height: 51, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 3 },
  buttonText: { fontSize: 16, color: "white", fontWeight: "800" },
  disabled: { opacity: .58 },
  tip: { color: theme.muted, textAlign: "center", fontSize: 12, marginTop: 17 }
});
