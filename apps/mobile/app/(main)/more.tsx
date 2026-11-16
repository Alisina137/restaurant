import {useCallback,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect} from "expo-router";
import * as SecureStore from "expo-secure-store";
import {direction,t} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {authClient} from "../../src/auth-client";
import {theme} from "../../src/theme";
import {floorRequest} from "../../src/floor-api";
import {o5} from "../../src/order-copy";
import {vibrationKey} from "../notifications";
export default function More(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [busy,setBusy]=useState(false),[vibrate,setVibrate]=useState(false),[unread,setUnread]=useState<number|null>(null);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  try{
   const [pref,alerts]=await Promise.all([SecureStore.getItemAsync(vibrationKey),
     floorRequest<{unread:number}>("/api/orders/notifications?page=1&unread=1")]);
   setVibrate(pref==="1");setUnread(alerts.unread);setError("");
  }catch(e){setError(e instanceof Error?e.message:o5(locale,"offlineAlerts"));}
 },[locale]);
 useFocusEffect(useCallback(()=>{
  void load();const timer=setInterval(()=>{void load();},15000);
  return()=>clearInterval(timer);
 },[load]));
 async function signOut(){
   setBusy(true);try{await authClient.signOut();router.replace("/sign-in");}
   finally{setBusy(false);}
 }
 function confirmSignOut(){
  Alert.alert(t(locale,"signOut"),t(locale,"signOut")+"?",[
   {text:o5(locale,"cancel"),style:"cancel"},
   {text:t(locale,"signOut"),style:"destructive",onPress:()=>{void signOut();}}]);
 }
 async function toggleVibration(){
  const next=!vibrate;setVibrate(next);
  try{await SecureStore.setItemAsync(vibrationKey,next?"1":"0");}
  catch(e){setVibrate(!next);setError(e instanceof Error?e.message:o5(locale,"failed"));}
 }
 return <ScrollView contentContainerStyle={styles.root}>
   <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{t(locale,"more")}</Text>
   <Pressable onPress={()=>router.push("/notifications")} accessibilityRole="button" style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name="notifications-outline" size={25} color={theme.brand}/>
     <Text style={styles.label}>{o5(locale,"notifications")}</Text>
     {unread!==null&&unread>0&&<View style={styles.badge}><Text style={styles.badgeText}>{unread>99?"99+":unread}</Text></View>}
     <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={19} color={theme.muted}/>
   </Pressable>
   <Pressable onPress={()=>router.push("/profile")} accessibilityRole="button" style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name="person-circle-outline" size={25} color={theme.brand}/>
     <Text style={styles.label}>{t(locale,"profile")} · {t(locale,"language")}</Text>
     <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={19} color={theme.muted}/>
   </Pressable>
   <View style={styles.card}>
     <Text style={[styles.cardTitle,{textAlign:rtl?"right":"left"}]}>{o5(locale,"notificationSettings")}</Text>
     <Text style={[styles.meta,{textAlign:rtl?"right":"left"}]}>{o5(locale,"alertPreference")}</Text>
     <Pressable onPress={()=>void toggleVibration()} accessibilityRole="switch"
       accessibilityState={{checked:vibrate}} style={[styles.pref,{flexDirection:rtl?"row-reverse":"row"}]}>
       <Ionicons name={vibrate?"notifications":"notifications-off-outline"} size={22} color={theme.brand}/>
       <Text style={styles.label}>{o5(locale,vibrate?"vibrateOn":"vibrateOff")}</Text>
       <Ionicons name={vibrate?"toggle":"toggle-outline"} size={28} color={theme.brand}/>
     </Pressable>
     <Text style={styles.meta}>{o5(locale,"readyInstructions")}</Text>
   </View>
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   <Pressable onPress={confirmSignOut} disabled={busy} accessibilityRole="button" style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name="log-out-outline" size={25} color={theme.danger}/>
     <Text style={[styles.label,{color:theme.danger}]}>{t(locale,"signOut")}</Text>
     {busy&&<ActivityIndicator color={theme.danger}/>}
   </Pressable>
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flexGrow:1,paddingTop:65,paddingHorizontal:19,paddingBottom:80,gap:14,backgroundColor:theme.background},
 title:{fontSize:27,fontWeight:"800",color:theme.ink,marginBottom:17},
 row:{backgroundColor:"white",borderWidth:1,borderColor:theme.border,borderRadius:15,
  padding:17,alignItems:"center",gap:13,minHeight:62},
 label:{flex:1,color:theme.ink,fontSize:15,fontWeight:"700"},
 badge:{backgroundColor:theme.brand,borderRadius:10,minWidth:25,paddingHorizontal:7,paddingVertical:4,alignItems:"center"},
 badgeText:{color:"white",fontSize:11,fontWeight:"900"},
 card:{backgroundColor:"white",borderWidth:1,borderColor:theme.border,borderRadius:15,padding:17,gap:10},
 cardTitle:{color:theme.ink,fontWeight:"800",fontSize:16},meta:{color:theme.muted,fontSize:12,lineHeight:19},
 pref:{alignItems:"center",gap:11,padding:10,backgroundColor:"#EFF7F2",borderRadius:12},
 error:{color:theme.danger,fontSize:13,padding:12}
});
