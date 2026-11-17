import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import {Ionicons} from "@expo/vector-icons";
import { direction, t, type Locale } from "@dineflow/shared";
import { authClient } from "../src/auth-client";
import { theme } from "../src/theme";
import { useLocale } from "../src/locale";
import {ma,webCallback} from "../src/auth-copy";

export default function SignIn() {
  const { locale, changeLocale } = useLocale();
  const rtl = direction(locale) === "rtl";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword,setShowPassword]=useState(false),[needsVerification,setNeedsVerification]=useState(false);
  const [verifying,setVerifying]=useState(false),[verificationMessage,setVerificationMessage]=useState("");
  const inFlight=useRef(false);
  async function submit() {
    if (!email.includes("@") || password.length<1 || inFlight.current) return;
    inFlight.current=true;setBusy(true); setError("");setNeedsVerification(false);setVerificationMessage("");
    try {
      const result = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (result.error) {
        if(result.error.code==="EMAIL_NOT_VERIFIED"){setNeedsVerification(true);setError(ma(locale,"unverified"));}
        else setError(t(locale, "invalidLogin"));
        return;
      }
      router.replace("/(main)/home");
    } catch { setError(t(locale, "offline")); }
    finally { inFlight.current=false;setBusy(false); }
  }
  async function resendVerification(){
    if(verifying||!email.includes("@"))return;
    const target=webCallback("/login");if(!target){setError(ma(locale,"unavailable"));return;}
    setVerifying(true);setError("");setVerificationMessage("");
    try{
      const response=await authClient.sendVerificationEmail({email:email.trim().toLowerCase(),callbackURL:target});
      if(response.error)throw new Error("EMAIL_UNAVAILABLE");
      setVerificationMessage(ma(locale,"sent"));
    }catch{setError(ma(locale,"retry"));}
    finally{setVerifying(false);}
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
        <View style={styles.passwordRow}>
          <TextInput style={styles.passwordInput} secureTextEntry={!showPassword} autoComplete="current-password" value={password}
            onChangeText={setPassword} accessibilityLabel={t(locale, "password")} textAlign="left" />
          <Pressable accessibilityRole="button" accessibilityLabel={ma(locale,showPassword?"hide":"show")}
            onPress={()=>setShowPassword(v=>!v)} style={styles.eyeButton}>
            <Ionicons name={showPassword?"eye-off-outline":"eye-outline"} size={22} color={theme.brand}/>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={()=>router.push("/forgot-password")} style={styles.forgotLink}>
          <Text style={styles.forgotText}>{ma(locale,"forgot")}</Text>
        </Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {needsVerification?<Pressable accessibilityRole="button" disabled={verifying||busy}
          onPress={()=>void resendVerification()} style={styles.verifyButton}>
          <Text style={styles.verifyText}>{verifying?ma(locale,"loading"):ma(locale,"resend")}</Text>
        </Pressable>:null}
        {verificationMessage?<Text accessibilityRole="alert" style={styles.verified}>{verificationMessage}</Text>:null}
        <Pressable accessibilityRole="button" disabled={busy || !email.includes("@") || password.length < 1} onPress={() => void submit()} style={[styles.button, (busy || !email.includes("@") || password.length < 1) && styles.disabled]}>
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
  passwordRow:{flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:theme.border,
    borderRadius:13,backgroundColor:"#fff",minHeight:51,marginBottom:7},
  passwordInput:{flex:1,minWidth:0,paddingHorizontal:14,height:50,fontSize:15,color:theme.ink},
  eyeButton:{width:48,height:48,alignItems:"center",justifyContent:"center"},
  forgotLink:{alignSelf:"flex-end",paddingVertical:10,marginBottom:11},
  forgotText:{color:theme.brand,fontSize:13,fontWeight:"800"},
  verifyButton:{padding:13,borderRadius:11,borderWidth:1,borderColor:theme.brand,alignItems:"center"},
  verifyText:{color:theme.brand,fontWeight:"800",fontSize:14},
  verified:{color:theme.brand,fontWeight:"700",fontSize:13,lineHeight:20},
  error: { color: theme.danger, paddingVertical: 8 },
  button: { backgroundColor: theme.brand, height: 51, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 3 },
  buttonText: { fontSize: 16, color: "white", fontWeight: "800" },
  disabled: { opacity: .58 },
  tip: { color: theme.muted, textAlign: "center", fontSize: 12, marginTop: 17 }
});
