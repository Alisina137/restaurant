import { useCallback, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { direction, t } from "@dineflow/shared";
import { fetchIdentity, type Identity } from "../../src/api";
import { authClient } from "../../src/auth-client";
import { theme } from "../../src/theme";
import { useLocale } from "../../src/locale";
import { router, useFocusEffect } from "expo-router";
import { floorRequest } from "../../src/floor-api";
import { f, type Board } from "../../src/floor";
import { o5 } from "../../src/order-copy";
import {gm7} from "../../src/guest-copy";
import {sr8} from "../../src/service-copy";
export default function Home() {
  const { locale, changeLocale } = useLocale();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [floor, setFloor] = useState<Board | null>(null);
  const [ordersStat,setOrdersStat]=useState<{active:number;ready:number;served?:number}|null>(null);
  const [alerts,setAlerts]=useState<{id:string;roundId:string;tableLabel:string;lastNotifiedAt:string}[]|null>(null);
  const [unreadCount,setUnreadCount]=useState<number|null>(null);
  const [guestPending,setGuestPending]=useState<number|null>(null);
  const [servicePending,setServicePending]=useState<number|null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const rtl = direction(locale) === "rtl";
  const load = useCallback(async (silent=false) => {
    if(!silent)setBusy(true); setError("");
    try {
      const data = await fetchIdentity();
      if (data.role !== "waiter") { setError("ACCESS"); setIdentity(null); return; }
      setIdentity(data);
      changeLocale(data.locale);
      try { const [b,stats]=await Promise.all([
       floorRequest<Board>("/api/floor/tables/board"),
       floorRequest<{active:number;ready:number}>("/api/orders/my/stats")]);
       setFloor(b);setOrdersStat(stats);
       try{const requests=await floorRequest<{active:number}>("/api/service/requests/count");setServicePending(requests.active);}catch{setServicePending(null);}
       try{const x=await floorRequest<{pending:number}>("/api/guest/staff/approvals/count");setGuestPending(x.pending);}catch{setGuestPending(null);}
        try{
          const notices=await floorRequest<{items:{id:string;roundId:string;tableLabel:string;lastNotifiedAt:string}[];unread:number}>(
           "/api/orders/notifications?unread=1&page=1");
          setAlerts(notices.items.slice(0,3));setUnreadCount(notices.unread);
        }catch{setAlerts(null);setUnreadCount(null);}
      } catch { setFloor(null);setOrdersStat(null);setAlerts(null);setUnreadCount(null);setServicePending(null); }
    } catch (e) {
      const message = String(e);
      if (message.includes("401")) { router.replace("/sign-in"); return; }
      setError(message.includes("403") ? "MEMBERSHIP" : "NETWORK");
    } finally { if(!silent)setBusy(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    void load();
    const timer=setInterval(()=>{if(AppState.currentState==="active")void load(true);},12000);
    const listener=AppState.addEventListener("change",x=>{if(x==="active")void load(true);});
    return()=>{clearInterval(timer);listener.remove();};
  }, [load]));
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
          <View style={[styles.panelRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <Ionicons name="grid-outline" color={theme.brand} size={23}/>
            <Text style={styles.sectionTitle}>{f(locale,"myActive")}</Text></View>
          <Text style={styles.title}>{floor?floor.tables.filter(t=>t.visitId&&t.assignedWaiterId===floor.actorId).length:"—"}</Text>
          <Pressable accessibilityRole="button" onPress={()=>router.push("/(main)/tables")} style={styles.action}>
            <Text style={styles.actionText}>{f(locale,"openTables")}</Text></Pressable>
        </View>
        <View style={styles.panel}>
          <View style={[styles.panelRow,{flexDirection:rtl?"row-reverse":"row"}]}>
            <Ionicons name="notifications-outline" size={24} color={theme.brand}/>
            <Text style={styles.sectionTitle}>{sr8(locale,"requests")}</Text></View>
          <Text style={styles.title}>{servicePending??"—"}</Text>
          <Text style={styles.muted}>{sr8(locale,"attention")}</Text>
          <Pressable style={styles.action} onPress={()=>router.push("/requests")}>
            <Text style={styles.actionText}>{sr8(locale,"view")}</Text></Pressable>
        </View>
        <View style={styles.panel}>
          <View style={[styles.panelRow,{flexDirection:rtl?"row-reverse":"row"}]}>
            <Ionicons name="receipt-outline" color={theme.brand} size={23}/>
            <Text style={styles.sectionTitle}>{o5(locale,"working")}</Text></View>
          <Text style={styles.title}>{ordersStat?.active??"—"}</Text>
          <Text style={styles.muted}>{o5(locale,"readyItems")}: {ordersStat?.ready??"—"}</Text>
          <Pressable style={styles.action} onPress={()=>router.push("/(main)/orders")}>
            <Text style={styles.actionText}>{o5(locale,"showActive")}</Text></Pressable>
        </View>
        <View style={styles.panel}>
          <View style={[styles.panelRow,{flexDirection:rtl?"row-reverse":"row"}]}>
            <Ionicons name="person-circle-outline" size={24} color={theme.brand}/>
            <Text style={styles.sectionTitle}>{gm7(locale,"approvals")}</Text></View>
          <Text style={styles.title}>{guestPending??"—"}</Text>
          <Text style={styles.muted}>{gm7(locale,"approvalDefault")}</Text>
          <Pressable style={styles.action} accessibilityRole="button" onPress={()=>router.push("/approvals")}>
            <Text style={styles.actionText}>{gm7(locale,"viewAll")}</Text></Pressable>
        </View>
        <View style={styles.panel}>
          <View style={[styles.panelRow,{flexDirection:rtl?"row-reverse":"row"}]}>
            <Ionicons name="notifications-outline" size={24} color={theme.brand}/>
            <Text style={styles.sectionTitle}>{o5(locale,"readyCount")}</Text></View>
          <Text style={styles.title}>{unreadCount??"—"}</Text>
          {alerts?.map(alert=><Pressable key={alert.id} style={[styles.alertRow,{flexDirection:rtl?"row-reverse":"row"}]}
             onPress={()=>router.push({pathname:"/order/[id]",params:{id:alert.roundId}})}>
              <Ionicons name="checkmark-circle-outline" color={theme.brand} size={19}/>
              <Text style={styles.alertLabel}>{o5(locale,"table")} {alert.tableLabel} · {o5(locale,"readyAlert")}</Text>
              <Ionicons name={rtl?"chevron-back":"chevron-forward"} color={theme.muted} size={18}/></Pressable>)}
          {unreadCount===0&&<Text style={styles.muted}>{o5(locale,"noAttention")}</Text>}
          <Pressable style={styles.action} onPress={()=>router.push("/notifications")}>
            <Text style={styles.actionText}>{o5(locale,"viewNotifications")}</Text></Pressable>
        </View>
        <View style={styles.panel}>
          <View style={[styles.panelRow, { flexDirection: rtl ? "row-reverse" : "row" }]}><Ionicons name="lock-closed-outline" color={theme.brand} size={23} /><Text style={styles.sectionTitle}>{t(locale, "secure")}</Text></View>
          <Text style={[styles.muted, { textAlign: rtl ? "right" : "left" }]}>{t(locale, "secureBody")}</Text>
        </View>
      </> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({
  alertRow:{alignItems:"center",backgroundColor:"#F1F8F4",borderRadius:10,padding:12,gap:9},
  alertLabel:{flex:1,fontSize:13,fontWeight:"800",color:theme.ink},

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
