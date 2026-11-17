import {useCallback,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {direction} from "@dineflow/shared";
import {fetchIdentity} from "../src/api";
import {useLocale} from "../src/locale";
import {theme} from "../src/theme";
import {FloorRequestError,floorRequest} from "../src/floor-api";
import {inboxIsValid,type ReadyInbox,type ReadyNotice} from "../src/mobile26-data";
import {m26} from "../src/mobile26-copy";
import {useLiveScreen} from "../src/use-live-screen";
import {o5} from "../src/order-copy";

type InboxResult={inbox:ReadyInbox;scope:string};
function dateLabel(value:string,locale:string){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"—":date.toLocaleString(locale);
}
export default function Notifications(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl",insets=useSafeAreaInsets();
 const [tab,setTab]=useState<"all"|"unread">("all"),[page,setPage]=useState(1);
 const [busy,setBusy]=useState(""),[actionError,setActionError]=useState(""),[message,setMessage]=useState("");
 const locked=useRef(false);
 const loader=useCallback(async():Promise<InboxResult>=>{
  let identity;
  try{identity=await fetchIdentity();}
  catch(err){if(String(err).includes("401"))throw new FloorRequestError(401,"UNAUTHENTICATED","Sign in again.");
   throw new Error(m26(locale,"loadFailed"));}
  if(identity.role!=="waiter"||!identity.tenantId)throw new FloorRequestError(403,"ACCESS_DENIED",m26(locale,"noAccess"));
  try{
   const inbox=await floorRequest<ReadyInbox>("/api/orders/notifications?page="+page+
    (tab==="unread"?"&unread=1":""));
   if(!inboxIsValid(inbox))throw new Error("INVALID_INBOX");
   return {inbox,scope:identity.user.id+"|"+identity.tenantId};
  }catch(err){
   if(err instanceof FloorRequestError&&(err.status===401||err.status===403))throw err;
   throw new Error(m26(locale,"loadFailed"));
  }
 },[page,tab,locale]);
 const {data,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen(
   "notifications:"+tab+":"+page,loader,12000);
 const inbox=data?.inbox;
 const maxPages=inbox?Math.max(1,Math.ceil(inbox.total/inbox.perPage)):1;
 const failure=actionError||(error==="ACCESS_DENIED"?m26(locale,"noAccess"):error);
 async function markRead(alert:ReadyNotice,open:boolean){
  if(locked.current)return;
  locked.current=true;setBusy(alert.id);setActionError("");setMessage("");
  try{
   if(!alert.readAt)await floorRequest("/api/orders/notifications/"+encodeURIComponent(alert.id)+"/read",
    {method:"POST",body:{}});
   if(open){router.push({pathname:"/order/[id]",params:{id:alert.roundId}});return;}
   await refresh(true);
  }catch(err){
   setActionError(err instanceof FloorRequestError&&err.status===403?
    m26(locale,"noAccess"):m26(locale,"loadFailed"));
  }finally{locked.current=false;setBusy("");}
 }
 async function markAll(){
  if(locked.current)return;
  locked.current=true;setBusy("all");setActionError("");setMessage("");
  try{
   await floorRequest("/api/orders/notifications/read-all",{method:"POST",body:{}});
   setMessage(m26(locale,"markedAll"));
   setPage(1);await refresh(true);
  }catch(err){
   setActionError(err instanceof FloorRequestError&&err.status===403?
     m26(locale,"noAccess"):m26(locale,"loadFailed"));
  }finally{locked.current=false;setBusy("");}
 }
 function confirmAll(){
  Alert.alert(m26(locale,"markAll"),m26(locale,"markAllConfirm"),[
   {text:m26(locale,"cancel"),style:"cancel"},
   {text:m26(locale,"confirm"),onPress:()=>void markAll()}
  ]);
 }
 function changeTab(value:"all"|"unread"){
  if(locked.current)return;setTab(value);setPage(1);setActionError("");setMessage("");
 }
 return <ScrollView style={styles.screen}
  contentContainerStyle={[styles.content,{paddingTop:Math.max(insets.top+10,24),paddingBottom:insets.bottom+55}]}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh(true)} tintColor={theme.brand}/>}>
  <View style={[styles.head,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable accessibilityRole="button" style={styles.icon} accessibilityLabel={o5(locale,"back")}
    onPress={()=>router.back()}>
    <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={23} color={theme.brand}/>
   </Pressable>
   <View style={styles.headText}>
    <Text style={[styles.caption,{textAlign:rtl?"right":"left"}]}>DINEFLOW / WAITER</Text>
    <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{o5(locale,"notifications")}</Text>
   </View>
   <Pressable accessibilityRole="button" style={styles.icon} disabled={refreshing}
    accessibilityLabel={o5(locale,"refresh")} onPress={()=>void refresh(true)}>
    <Ionicons name="refresh-outline" size={22} color={theme.brand}/>
   </Pressable>
  </View>
  <View style={styles.summary}>
   <View style={[styles.summaryTop,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.summaryIcon}><Ionicons name="notifications-outline" color={theme.brand} size={24}/></View>
    <View style={{flex:1,gap:4}}>
     <Text style={[styles.summaryTitle,{textAlign:rtl?"right":"left"}]}>
      {m26(locale,"unreadCount")} · {inbox?.unread??"—"}</Text>
     <Text style={[styles.subtle,{textAlign:rtl?"right":"left"}]}>{m26(locale,"deliveryMode")}</Text>
    </View>
   </View>
   {lastUpdated&&<Text style={[styles.stamp,{textAlign:rtl?"right":"left"}]}>
    {m26(locale,"lastSynced")}: {dateLabel(new Date(lastUpdated).toISOString(),locale)}</Text>}
  </View>
  <View accessibilityRole="tablist" style={styles.tabs}>
   {(["all","unread"] as const).map(value=>
    <Pressable key={value} accessibilityRole="tab" accessibilityState={{selected:tab===value}}
     disabled={!!busy} onPress={()=>changeTab(value)}
     style={[styles.tab,tab===value&&styles.tabOn]}>
     <Text style={[styles.tabText,tab===value&&styles.tabTextOn]}>
      {value==="all"?o5(locale,"allNotifications"):o5(locale,"unread")}</Text>
    </Pressable>)}
  </View>
  {(!!error&&!!data)&&<View style={styles.stale}>
    <Ionicons name="cloud-offline-outline" size={19} color={theme.danger}/>
    <Text style={styles.staleText}>{m26(locale,"stale")}</Text>
   </View>}
  {!!failure&&<View accessibilityRole="alert" style={styles.error}>
    <Text style={styles.errorText}>{failure}</Text>
    <Pressable accessibilityRole="button" onPress={()=>void refresh(true)}
     style={styles.retry}><Text style={styles.actionText}>{o5(locale,"retry")}</Text></Pressable>
   </View>}
  {!!message&&<Text accessibilityRole="alert" style={styles.success}>{message}</Text>}
  {!!inbox&&inbox.unread>0&&tab==="all"&&<Pressable accessibilityRole="button"
    disabled={!!busy} style={[styles.allRead,!!busy&&styles.disabled]} onPress={confirmAll}>
    {busy==="all"?<ActivityIndicator color={theme.brand}/>:<Ionicons name="checkmark-done-outline" color={theme.brand} size={19}/>}
    <Text style={styles.actionText}>{m26(locale,"markAll")}</Text>
   </Pressable>}
  {loading&&!data?<View style={styles.empty}><ActivityIndicator size="large" color={theme.brand}/></View>:
   inbox?.items.length?inbox.items.map(item=>
   <View key={item.id} style={[styles.card,!item.readAt&&styles.unreadCard]}>
    <View style={[styles.cardHead,{flexDirection:rtl?"row-reverse":"row"}]}>
     <View style={styles.glyph}><Ionicons name="restaurant-outline" size={22} color={theme.brand}/></View>
     <View style={styles.cardMain}>
      <Text style={[styles.cardTitle,{textAlign:rtl?"right":"left"}]}>
       {o5(locale,"readyAlert")} · {o5(locale,"table")} {item.tableLabel}</Text>
      <Text style={[styles.subtle,{textAlign:rtl?"right":"left"}]}>{o5(locale,"readyInstructions")}</Text>
      <Text style={[styles.date,{textAlign:rtl?"right":"left"}]}>
       {dateLabel(item.lastNotifiedAt,locale)}</Text>
     </View>
     {!item.readAt&&<View style={styles.dot}/>}
    </View>
    <View style={[styles.actions,{flexDirection:rtl?"row-reverse":"row"}]}>
     {!item.readAt&&<Pressable accessibilityRole="button" style={styles.secondary}
       disabled={!!busy} onPress={()=>void markRead(item,false)}>
       <Text style={styles.actionText}>{o5(locale,"markRead")}</Text>
      </Pressable>}
     <Pressable accessibilityRole="button" disabled={!!busy}
      onPress={()=>void markRead(item,true)} style={[styles.primary,!!busy&&styles.disabled]}>
      {busy===item.id?<ActivityIndicator color="white"/>:
       <Ionicons name="open-outline" size={17} color="white"/>}
      <Text style={styles.primaryText}>{o5(locale,"openOrder")}</Text>
     </Pressable>
    </View>
   </View>):
   !error?<View style={styles.empty}>
     <Ionicons name="notifications-off-outline" size={37} color={theme.muted}/>
     <Text style={styles.subtle}>{o5(locale,"noNotifications")}</Text>
    </View>:null}
  {!!inbox&&maxPages>1&&<View style={styles.pager}>
   <Pressable accessibilityRole="button" disabled={page<=1||!!busy}
    onPress={()=>setPage(value=>Math.max(1,value-1))} style={styles.pagerButton}>
    <Text style={styles.actionText}>{o5(locale,"previous")}</Text>
   </Pressable>
   <Text style={styles.subtle}>{page} / {maxPages}</Text>
   <Pressable accessibilityRole="button" disabled={page>=maxPages||!!busy}
    onPress={()=>setPage(value=>Math.min(maxPages,value+1))} style={styles.pagerButton}>
    <Text style={styles.actionText}>{o5(locale,"next")}</Text>
   </Pressable>
  </View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:theme.background},
 content:{paddingHorizontal:17,gap:14},
 head:{alignItems:"center",gap:12},
 headText:{flex:1,minWidth:0},caption:{color:theme.brand,fontSize:10,fontWeight:"800",letterSpacing:1},
 title:{fontSize:25,fontWeight:"900",color:theme.ink,marginTop:4},
 icon:{width:46,height:46,backgroundColor:theme.brandSoft,borderRadius:14,
  alignItems:"center",justifyContent:"center"},
 summary:{borderRadius:17,padding:17,gap:12,backgroundColor:"#E8F6EE",
  borderWidth:1,borderColor:"#D6EBDD"},
 summaryTop:{gap:12,alignItems:"flex-start"},
 summaryIcon:{width:47,height:47,borderRadius:14,alignItems:"center",
  justifyContent:"center",backgroundColor:"#FFF"},
 summaryTitle:{fontSize:17,fontWeight:"900",color:theme.brand},
 subtle:{fontSize:12,color:theme.muted,lineHeight:20},
 stamp:{fontSize:11,color:theme.brand,fontWeight:"600"},
 tabs:{flexDirection:"row",backgroundColor:"#E7EFEB",padding:4,gap:5,borderRadius:14},
 tab:{flex:1,minHeight:45,alignItems:"center",justifyContent:"center",borderRadius:11},
 tabOn:{backgroundColor:"#fff"},tabText:{fontSize:14,fontWeight:"700",color:theme.muted},
 tabTextOn:{color:theme.brand,fontWeight:"900"},
 stale:{backgroundColor:"#FFF5EE",borderWidth:1,borderColor:"#F0D7CB",
  borderRadius:12,padding:12,gap:9,flexDirection:"row",alignItems:"center"},
 staleText:{flex:1,color:theme.danger,fontSize:12,lineHeight:19},
 error:{borderRadius:12,backgroundColor:"#FFF0EF",padding:14,gap:10},
 errorText:{color:theme.danger,fontSize:13},
 retry:{minHeight:40,justifyContent:"center",alignSelf:"flex-start"},
 actionText:{color:theme.brand,fontWeight:"800",fontSize:13},
 success:{color:theme.brand,fontWeight:"800",fontSize:13},
 allRead:{alignSelf:"flex-end",minHeight:45,flexDirection:"row",alignItems:"center",
  gap:8,paddingHorizontal:13,borderRadius:12,borderWidth:1,borderColor:theme.border,
  backgroundColor:"#fff"},
 disabled:{opacity:.55},
 card:{backgroundColor:"#fff",borderColor:theme.border,borderWidth:1,borderRadius:17,padding:15,gap:13},
 unreadCard:{backgroundColor:"#F8FEFA",borderColor:"#9DCFAD"},
 cardHead:{gap:11,alignItems:"flex-start"},
 glyph:{width:44,height:44,borderRadius:13,alignItems:"center",justifyContent:"center",
  backgroundColor:theme.brandSoft},
 cardMain:{flex:1,minWidth:0,gap:6},
 cardTitle:{fontSize:15,color:theme.ink,fontWeight:"850"},
 date:{color:theme.muted,fontSize:11},
 dot:{width:10,height:10,borderRadius:6,backgroundColor:theme.brand},
 actions:{gap:9,alignItems:"center",justifyContent:"flex-end",flexWrap:"wrap"},
 secondary:{minHeight:45,paddingHorizontal:12,justifyContent:"center",
  borderColor:theme.border,borderWidth:1,borderRadius:11},
 primary:{minHeight:45,backgroundColor:theme.brand,borderRadius:11,paddingHorizontal:14,
  flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center"},
 primaryText:{color:"#fff",fontSize:13,fontWeight:"800"},
 empty:{alignItems:"center",justifyContent:"center",gap:13,paddingVertical:62},
 pager:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",
  paddingVertical:8,gap:10},
 pagerButton:{minHeight:44,justifyContent:"center",paddingHorizontal:8}
});
