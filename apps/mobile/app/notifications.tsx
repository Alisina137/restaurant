import {useCallback,useState} from "react";
import {ActivityIndicator,AppState,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../src/locale";
import {theme} from "../src/theme";
import {floorRequest} from "../src/floor-api";
import {o5} from "../src/order-copy";

export type ReadyAlert={id:string;type:string;roundId:string;ticketId:string;visitId:string;
 readAt:string|null;createdAt:string;lastNotifiedAt:string;
 tableLabel:string;tableId:string;status:string};
type Alerts={items:ReadyAlert[];total:number;unread:number;page:number;perPage:number};
export const vibrationKey="dineflow:vibration:ready";
export default function Notifications(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [tab,setTab]=useState<"all"|"unread">("all"),[page,setPage]=useState(1);
 const [data,setData]=useState<Alerts|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState("");
 const load=useCallback(async(silent=false)=>{
   if(!silent)setLoading(true);setError("");
   try{
    const result=await floorRequest<Alerts>("/api/orders/notifications?page="+page+(tab==="unread"?"&unread=1":""));
    setData(result);
   }catch(e){setError(e instanceof Error?e.message:o5(locale,"offlineAlerts"));}
   finally{setLoading(false);}
 },[page,tab,locale]);
 useFocusEffect(useCallback(()=>{
  void load();
  const timer=setInterval(()=>{void load(true);},12000);
  const app=AppState.addEventListener("change",state=>{if(state==="active")void load(true);});
  return()=>{clearInterval(timer);app.remove();};
 },[load]));
 async function markRead(alert:ReadyAlert,open:boolean){
  setBusy(alert.id);setError("");
  try{
   if(!alert.readAt)await floorRequest("/api/orders/notifications/"+alert.id+"/read",{method:"POST",body:{}});
   if(open)router.push({pathname:"/order/[id]",params:{id:alert.roundId}});
   await load(true);
  }catch(e){setError(e instanceof Error?e.message:o5(locale,"failed"));}
  finally{setBusy("");}
 }
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}
   refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()} tintColor={theme.brand}/>}>
   <View style={[styles.head,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Pressable style={styles.icon} accessibilityLabel={o5(locale,"back")} onPress={()=>router.back()}>
      <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={23} color={theme.brand}/></Pressable>
    <View style={styles.headText}><Text style={styles.caption}>DINEFLOW / {o5(locale,"readyAlert")}</Text>
      <Text style={styles.title}>{o5(locale,"notifications")}</Text></View>
    <Pressable style={styles.icon} accessibilityLabel={o5(locale,"refresh")} onPress={()=>void load()}>
      <Ionicons name="refresh-outline" size={22} color={theme.brand}/></Pressable>
   </View>
   <View style={styles.metrics}><Ionicons name="notifications-outline" color={theme.brand} size={24}/>
    <Text style={styles.metricsText}>{o5(locale,"unread")}: {data?.unread??"—"}</Text></View>
   <View style={styles.tabs}>{(["all","unread"] as const).map(t=>
    <Pressable key={t} onPress={()=>{setTab(t);setPage(1);setData(null);}} accessibilityRole="tab"
      accessibilityState={{selected:tab===t}} style={[styles.tab,tab===t&&styles.tabOn]}>
      <Text style={[styles.tabText,tab===t&&styles.tabTextOn]}>{t==="all"?o5(locale,"allNotifications"):o5(locale,"unread")}</Text></Pressable>)}</View>
   {!!error&&<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
      <Pressable onPress={()=>void load()}><Text style={styles.actionText}>{o5(locale,"retry")}</Text></Pressable></View>}
   {loading&&!data?<ActivityIndicator size="large" color={theme.brand}/>:
     data?.items.length?data.items.map(x=><View key={x.id} style={[styles.card,!x.readAt&&styles.unread]}>
      <View style={[styles.cardHead,{flexDirection:rtl?"row-reverse":"row"}]}>
       <View style={styles.glyph}><Ionicons name="restaurant-outline" size={22} color={theme.brand}/></View>
       <View style={styles.cardMain}>
        <Text style={[styles.cardTitle,{textAlign:rtl?"right":"left"}]}>{o5(locale,"readyAlert")} · {o5(locale,"table")} {x.tableLabel}</Text>
        <Text style={[styles.muted,{textAlign:rtl?"right":"left"}]}>{o5(locale,"readyInstructions")}</Text>
        <Text style={[styles.date,{textAlign:rtl?"right":"left"}]}>{new Date(x.lastNotifiedAt).toLocaleString(locale)}</Text>
       </View>
       {!x.readAt&&<View style={styles.dot}/>}
      </View>
      <View style={[styles.actions,{flexDirection:rtl?"row-reverse":"row"}]}>
       {!x.readAt&&<Pressable onPress={()=>void markRead(x,false)} disabled={busy===x.id} style={styles.subtleButton}>
        <Text style={styles.actionText}>{o5(locale,"markRead")}</Text></Pressable>}
       <Pressable onPress={()=>void markRead(x,true)} disabled={busy===x.id} style={styles.primary}>
         {busy===x.id?<ActivityIndicator color="white"/>:<Ionicons name="open-outline" size={16} color="white"/>}
         <Text style={styles.primaryText}>{o5(locale,"openOrder")}</Text></Pressable>
      </View>
     </View>):
     <View style={styles.empty}><Ionicons name="notifications-off-outline" size={39} color={theme.muted}/>
       <Text style={styles.muted}>{o5(locale,"noNotifications")}</Text></View>}
   {!!data&&data.total>data.perPage&&<View style={styles.pager}>
     <Pressable disabled={page<=1} onPress={()=>setPage(n=>n-1)}><Text style={styles.actionText}>{o5(locale,"previous")}</Text></Pressable>
     <Text style={styles.muted}>{page} / {Math.ceil(data.total/data.perPage)}</Text>
     <Pressable disabled={page>=Math.ceil(data.total/data.perPage)} onPress={()=>setPage(n=>n+1)}>
       <Text style={styles.actionText}>{o5(locale,"next")}</Text></Pressable>
    </View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:theme.background},content:{paddingTop:58,paddingHorizontal:18,paddingBottom:65,gap:15},
 head:{alignItems:"center",justifyContent:"space-between",gap:12},
 headText:{flex:1},caption:{fontSize:10,fontWeight:"900",color:theme.brand,letterSpacing:1},
 title:{fontSize:23,fontWeight:"800",color:theme.ink},
 icon:{width:43,height:43,backgroundColor:theme.brandSoft,borderRadius:13,alignItems:"center",justifyContent:"center"},
 metrics:{padding:17,borderRadius:14,backgroundColor:"#E8F6EE",flexDirection:"row",alignItems:"center",gap:12},
 metricsText:{fontSize:16,fontWeight:"800",color:theme.brand},
 tabs:{flexDirection:"row",borderRadius:14,padding:4,gap:5,backgroundColor:"#E8F0EA"},
 tab:{flex:1,paddingVertical:12,alignItems:"center",borderRadius:10},tabOn:{backgroundColor:"white"},
 tabText:{fontSize:14,fontWeight:"700",color:theme.muted},tabTextOn:{color:theme.brand},
 card:{backgroundColor:"white",borderColor:theme.border,borderWidth:1,borderRadius:17,padding:15,gap:15},
 unread:{borderColor:"#96CFB1",backgroundColor:"#F8FEFA"},
 cardHead:{alignItems:"flex-start",gap:11},glyph:{width:42,height:42,backgroundColor:theme.brandSoft,borderRadius:12,alignItems:"center",justifyContent:"center"},
 cardMain:{flex:1,gap:7},cardTitle:{fontSize:15,fontWeight:"800",color:theme.ink},
 muted:{fontSize:12,color:theme.muted,lineHeight:21},date:{fontSize:11,color:theme.muted},dot:{width:9,height:9,borderRadius:5,backgroundColor:theme.brand},
 actions:{alignItems:"center",justifyContent:"flex-end",gap:9},
 subtleButton:{paddingVertical:12,paddingHorizontal:13,borderWidth:1,borderColor:theme.border,borderRadius:11},
 actionText:{color:theme.brand,fontSize:13,fontWeight:"800"},
 primary:{flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center",paddingVertical:13,
  paddingHorizontal:15,backgroundColor:theme.brand,borderRadius:11},
 primaryText:{color:"white",fontWeight:"800",fontSize:13},
 error:{backgroundColor:"#FEEEEE",padding:15,borderRadius:12,gap:10},errorText:{color:theme.danger},
 empty:{alignItems:"center",gap:14,paddingVertical:85},pager:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:15}
});
