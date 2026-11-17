import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { direction, t, type Locale } from "@dineflow/shared";
import { authenticatedFetch, fetchIdentity, type Identity } from "../src/api";
import { useLocale } from "../src/locale";
import { theme } from "../src/theme";
import {authClient} from "../src/auth-client";
import {ma} from "../src/auth-copy";
export default function Profile() {
  const { locale, changeLocale } = useLocale();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name,setName]=useState(""),[success,setSuccess]=useState("");
  const mutationLock=useRef(false);
  const rtl = direction(locale) === "rtl";
  useEffect(() => {
    fetchIdentity().then(data=>{setIdentity(data);setName(data.user.name);}).catch(() => setError(t(locale, "offline")));
  }, []);
  async function updateLocale(value: Locale) {
    if(mutationLock.current)return;mutationLock.current=true;
    setBusy(true); setError("");setSuccess("");
    try {
      await authenticatedFetch("/api/preferences/locale", { method: "PUT", body: JSON.stringify({ locale: value }) });
      changeLocale(value);
    } catch { setError(t(locale, "offline")); }
    finally {mutationLock.current=false;setBusy(false); }
  }
  async function saveName(){
    const cleaned=name.trim();
    if(cleaned.length<2||cleaned.length>80){setError(ma(locale,"invalidName"));return;}
    if(!identity||cleaned===identity.user.name||mutationLock.current)return;
    mutationLock.current=true;setBusy(true);setError("");setSuccess("");
    try{
      const result=await authClient.updateUser({name:cleaned});
      if(result.error)throw new Error("PROFILE_FAILED");
      const next=await fetchIdentity();setIdentity(next);setName(next.user.name);
      setSuccess(ma(locale,"saved"));
    }catch{setError(ma(locale,"error"));}
    finally{mutationLock.current=false;setBusy(false);}
  }
  return <ScrollView contentContainerStyle={styles.root}>
    <Pressable onPress={() => router.back()} accessibilityRole="button" style={[styles.back, { flexDirection: rtl ? "row-reverse" : "row" }]}><Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={22} color={theme.brand} /><Text style={styles.backText}>{t(locale, "more")}</Text></Pressable>
    <Text style={[styles.title, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "profile")}</Text>
    <View style={styles.card}>
      <Text style={styles.secondary}>{t(locale, "profile")}</Text>
      {identity ? <><Text style={styles.name}>{identity.user.name}</Text>
        <Text style={[styles.secondary,{writingDirection:"ltr"}]}>{identity.user.email}</Text>
        <Text style={[styles.label,{textAlign:rtl?"right":"left"}]}>{ma(locale,"name")}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} autoComplete="name"
          accessibilityLabel={ma(locale,"name")} maxLength={80} editable={!busy}/>
        <Pressable accessibilityRole="button" disabled={busy||name.trim()===identity.user.name}
          onPress={()=>void saveName()} style={[styles.button,(busy||name.trim()===identity.user.name)&&styles.disabled]}>
          {busy?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>{ma(locale,"save")}</Text>}
        </Pressable></> : <ActivityIndicator color={theme.brand} />}
    </View>
    <View style={styles.card}>
      <Text style={styles.section}>{t(locale, "language")}</Text>
      {(["fa-AF", "ps-AF", "en"] as const).map((value) => <Pressable key={value} disabled={busy} onPress={() => void updateLocale(value)} accessibilityRole="radio" accessibilityState={{ checked: value === locale }}
          style={[styles.localeRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <Text style={styles.localeLabel}>{value === "fa-AF" ? "دری" : value === "ps-AF" ? "پښتو" : "English"}</Text>
        <Ionicons name={value === locale ? "radio-button-on" : "radio-button-off"} size={22} color={value === locale ? theme.brand : theme.muted} />
      </Pressable>)}
      {busy && <ActivityIndicator color={theme.brand} />}
    </View>
    <Pressable accessibilityRole="button" style={[styles.securityLink,{flexDirection:rtl?"row-reverse":"row"}]}
      onPress={()=>router.push("/security")}>
      <Ionicons name="shield-checkmark-outline" size={25} color={theme.brand}/>
      <View style={{flex:1}}><Text style={styles.section}>{ma(locale,"security")}</Text>
        <Text style={styles.secondary}>{ma(locale,"securityHint")}</Text></View>
      <Ionicons name={rtl?"chevron-back":"chevron-forward"} color={theme.muted} size={20}/>
    </Pressable>
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!success&&<Text accessibilityRole="alert" style={styles.success}>{success}</Text>}
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
  label:{color:theme.ink,fontWeight:"700",fontSize:14},
  input:{minHeight:48,borderRadius:12,borderWidth:1,borderColor:theme.border,paddingHorizontal:12,
    backgroundColor:"#fff",color:theme.ink,fontSize:15},
  button:{minHeight:46,backgroundColor:theme.brand,borderRadius:11,alignItems:"center",justifyContent:"center"},
  buttonText:{fontSize:14,fontWeight:"800",color:"#fff"},disabled:{opacity:.55},
  securityLink:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,borderRadius:theme.radius,
    padding:18,alignItems:"center",gap:13,minHeight:72},
  success:{color:theme.brand,fontWeight:"700",fontSize:13},
  error: { color: theme.danger }
});
