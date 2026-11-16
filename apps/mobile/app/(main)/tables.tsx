import {useCallback,useMemo,useState} from "react";
import {ActivityIndicator,AppState,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {useFocusEffect,router} from "expo-router";
import {Ionicons} from "@expo/vector-icons";
import {direction} from "@dineflow/shared";
import {floorRequest,FloorRequestError} from "../../src/floor-api";
import {f,type Board,type Status,type Table} from "../../src/floor";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {o5} from "../../src/order-copy";
import {sr8,type ServiceList} from "../../src/service-copy";
import {type Page,type OrderSummary,price} from "../../src/order-types";
type Tab="all"|"mine"|"attention";
const allStates:Status[]=["available","occupied","cleaning","disabled"];
export default function Tables(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [data,setData]=useState<Board|null>(null),[ready,setReady]=useState<OrderSummary[]>([]),[requests,setRequests]=useState<ServiceList["items"]>([]),[tab,setTab]=useState<Tab>("all");
 const [filter,setFilter]=useState<Status|null>(null),[query,setQuery]=useState("");
 const [busy,setBusy]=useState(true),[error,setError]=useState("");
 const load=useCallback(async(quiet=false)=>{
  if(!quiet)setBusy(true);
  setError("");
  try{
   const board=await floorRequest<Board>("/api/floor/tables/board");
   setData(board);
   try{
    const orders=await floorRequest<Page<OrderSummary>>("/api/orders/my?status=ready&page=1");
    setReady(orders.items);
   }catch{setReady([]);}
    try{const r=await floorRequest<ServiceList>("/api/service/requests?status=active&page=1");setRequests(r.items);}catch{setRequests([]);}
  }
  catch(e){
   if(e instanceof FloorRequestError&&e.status===401){router.replace("/sign-in");return;}
   setError(e instanceof Error?e.message:f(locale,"offline"));
  }finally{setBusy(false);}
 },[locale]);
 useFocusEffect(useCallback(()=>{
  void load();
  const timer=setInterval(()=>{void load(true);},15000);
  const subscription=AppState.addEventListener("change",state=>{if(state==="active")void load(true);});
  return ()=>{clearInterval(timer);subscription.remove();};
 },[load]));
 const visible=useMemo(()=>!data||tab==="attention"?[]:data.tables.filter(t=>
  (tab!=="mine"||t.assignedWaiterId===data.actorId)&&
  (!filter||t.status===filter)&&
  (!query.trim()||[t.label,t.sectionName].some(v=>v.toLowerCase().includes(query.trim().toLowerCase())))),
 [tab,data,filter,query]);
 function switchTab(next:Tab){setTab(next);setFilter(null);}
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}
   refreshControl={<RefreshControl refreshing={busy} tintColor={theme.brand} onRefresh={()=>void load()}/>}>
  <View style={[styles.top,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View><Text style={[styles.eyebrow,{textAlign:rtl?"right":"left"}]}>DINEFLOW · {f(locale,"live")}</Text>
      <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{f(locale,"title")}</Text></View>
    <Pressable onPress={()=>void load()} accessibilityRole="button" accessibilityLabel={f(locale,"refresh")} style={styles.iconButton}>
      <Ionicons name="refresh" size={22} color={theme.brand}/></Pressable>
  </View>
  <View style={styles.tabs}>{(["all","mine","attention"] as Tab[]).map(key=>
    <Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:tab===key}}
      style={[styles.tab,tab===key&&styles.selected]} onPress={()=>switchTab(key)}>
      <Text style={[styles.tabText,tab===key&&styles.tabTextActive]}>{f(locale,key)}</Text>
    </Pressable>)}</View>
  {tab!=="attention"&&<>
    <View style={[styles.searchBox,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Ionicons name="search-outline" size={20} color={theme.muted}/>
      <TextInput value={query} onChangeText={setQuery} autoCorrect={false} placeholder={f(locale,"search")}
        placeholderTextColor={theme.muted} style={[styles.search,{textAlign:rtl?"right":"left"}]}/></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      <Pressable onPress={()=>setFilter(null)} style={[styles.chip,!filter&&styles.chipSelected]}>
        <Text style={[styles.chipText,!filter&&styles.chipTextSelected]}>{f(locale,"all")}</Text></Pressable>
      {allStates.map(s=><Pressable key={s} onPress={()=>setFilter(s)} style={[styles.chip,filter===s&&styles.chipSelected]}>
        <Text style={[styles.chipText,filter===s&&styles.chipTextSelected]}>{f(locale,s)}</Text></Pressable>)}
    </ScrollView>
  </>}
  {error&&<View style={styles.error}><Ionicons name="alert-circle-outline" size={22} color={theme.danger}/>
    <Text style={styles.errorText}>{error}</Text>
    <Pressable accessibilityRole="button" onPress={()=>void load()}><Text style={styles.retry}>{f(locale,"retry")}</Text></Pressable></View>}
  {!data&&busy?<View style={styles.center}><ActivityIndicator size="large" color={theme.brand}/><Text style={styles.subtle}>{f(locale,"loading")}</Text></View>:
   tab==="attention"?<View style={styles.list}>
      {requests.map(r=><Pressable key={r.id} style={styles.attentionCard}
       onPress={()=>router.push("/requests")} accessibilityRole="button">
        <View style={[styles.cardHead,{flexDirection:rtl?"row-reverse":"row"}]}>
          <Ionicons name="notifications-outline" size={23} color={theme.brand}/>
          <View style={styles.cardInfo}><Text style={styles.cardName}>
             {sr8(locale,r.type)} · {sr8(locale,"table")} {r.tableLabel}</Text>
             <Text style={styles.meta}>{sr8(locale,r.status==="pending"?"pending":"acknowledged")}</Text>
          </View></View></Pressable>)}
      {ready.length>0?ready.map(r=><Pressable key={r.id} style={styles.attentionCard}
       onPress={()=>router.push({pathname:"/order/[id]",params:{id:r.id}})}
       accessibilityRole="button">
        <View style={[styles.cardHead,{flexDirection:rtl?"row-reverse":"row"}]}>
          <View style={styles.alertIcon}><Ionicons name="notifications-outline" size={22} color={theme.brand}/></View>
          <View style={styles.cardInfo}>
           <Text style={[styles.cardName,{textAlign:rtl?"right":"left"}]}>{o5(locale,"readyAlert")} · {o5(locale,"table")} {r.tableLabel}</Text>
           <Text style={[styles.meta,{textAlign:rtl?"right":"left"}]}>
             {o5(locale,"round")} #{r.roundNumber} · {o5(locale,r.status)}</Text>
           <Text style={[styles.meta,{textAlign:rtl?"right":"left"}]}>{price(r.totalMinor,locale)}</Text>
          </View>
          <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={20} color={theme.brand}/>
        </View>
       </Pressable>):requests.length===0?<View style={styles.empty}>
         <Ionicons name="checkmark-circle-outline" size={40} color={theme.brand}/>
         <Text style={[styles.subtle,{textAlign:"center"}]}>{o5(locale,"noAttention")}</Text></View>:null}
      {!!ready.length&&<Pressable style={styles.openOrders}
       onPress={()=>router.push({pathname:"/(main)/orders",params:{tab:"ready"}})}>
       <Text style={styles.openOrdersText}>{o5(locale,"showActive")}</Text></Pressable>}
    </View>:
   visible.length===0?<View style={styles.empty}><Ionicons name="grid-outline" size={40} color={theme.muted}/>
     <Text style={[styles.subtle,{textAlign:"center"}]}>{f(locale,tab==="mine"?"noneMine":"empty")}</Text></View>:
   <View style={styles.list}>{visible.map(table=><TableRow key={table.id} table={table} rtl={rtl} locale={locale}
     onOpen={()=>router.push({pathname:"/table/[id]",params:{id:table.id}})}/>)}</View>}
  {data&&tab==="attention"&&<Text style={[styles.footer,{textAlign:rtl?"right":"left"}]}>{o5(locale,"readyInstructions")}</Text>}
 </ScrollView>;
}
function TableRow({table,locale,rtl,onOpen}:{table:Table;locale:import("@dineflow/shared").Locale;rtl:boolean;onOpen:()=>void}){
 const tint=table.status==="occupied"?"#AA741D":table.status==="cleaning"?"#6B75AD":
 table.status==="disabled"?theme.muted:theme.brand;
 const background=table.status==="occupied"?"#FFF5E5":table.status==="cleaning"?"#EEF1FB":
 table.status==="disabled"?"#F0F3F1":theme.brandSoft;
 return <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={table.label+" "+f(locale,table.status)}
   style={[styles.card,{flexDirection:rtl?"row-reverse":"row"}]}>
   <View style={[styles.tableIcon,{backgroundColor:background}]}><Ionicons name="restaurant-outline" size={23} color={tint}/></View>
   <View style={styles.cardInfo}>
     <View style={[styles.cardHead,{flexDirection:rtl?"row-reverse":"row"}]}>
       <Text numberOfLines={1} style={styles.cardName}>{table.label}</Text>
       <View style={[styles.badge,{backgroundColor:background}]}><Text style={[styles.badgeText,{color:tint}]}>{f(locale,table.status)}</Text></View>
     </View>
     <Text style={[styles.meta,{textAlign:rtl?"right":"left"}]}>{table.sectionName} · {table.visitPartySize??table.seats} {f(locale,table.visitId?"guests":"seats")}</Text>
     <Text numberOfLines={1} style={[styles.meta,{textAlign:rtl?"right":"left"}]}>{f(locale,"waiter")}: {table.assignedWaiterName??f(locale,"unassigned")}</Text>
   </View>
   <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={19} color={theme.muted}/>
 </Pressable>;
}
const styles=StyleSheet.create({
 attentionCard:{backgroundColor:"#F8FEFA",borderColor:"#A9D8C1",borderWidth:1,borderRadius:15,padding:16,gap:10},
 alertIcon:{width:43,height:43,backgroundColor:theme.brandSoft,borderRadius:12,alignItems:"center",justifyContent:"center"},
 openOrders:{backgroundColor:theme.brand,borderRadius:12,minHeight:49,alignItems:"center",justifyContent:"center"},
 openOrdersText:{color:"white",fontSize:14,fontWeight:"800"},

 screen:{flex:1,backgroundColor:theme.background},
 content:{paddingHorizontal:17,paddingTop:60,paddingBottom:115,gap:16},
 top:{alignItems:"center",justifyContent:"space-between"},
 eyebrow:{color:theme.brand,fontSize:11,fontWeight:"900",letterSpacing:1},
 title:{color:theme.ink,fontSize:26,fontWeight:"800",marginTop:6},
 iconButton:{width:44,height:44,backgroundColor:theme.brandSoft,borderRadius:14,alignItems:"center",justifyContent:"center"},
 tabs:{flexDirection:"row",padding:5,gap:4,backgroundColor:"#EAF0EC",borderRadius:14},
 tab:{flex:1,paddingVertical:12,paddingHorizontal:5,alignItems:"center",borderRadius:11},
 selected:{backgroundColor:"#FFF",shadowColor:"#163D2D",shadowOpacity:.08,shadowRadius:8,elevation:2},
 tabText:{fontSize:12,fontWeight:"700",color:theme.muted,textAlign:"center"},
 tabTextActive:{color:theme.brand},
 searchBox:{backgroundColor:"#FFF",height:48,alignItems:"center",borderWidth:1,borderColor:theme.border,borderRadius:13,paddingHorizontal:13,gap:9},
 search:{flex:1,color:theme.ink,fontSize:15},
 filters:{gap:9,alignItems:"center"},
 chip:{paddingVertical:9,paddingHorizontal:15,borderRadius:30,borderWidth:1,borderColor:theme.border,backgroundColor:"#FFF"},
 chipSelected:{backgroundColor:theme.brandSoft,borderColor:"#A5D7BE"},
 chipText:{fontWeight:"700",fontSize:13,color:theme.muted},
 chipTextSelected:{color:theme.brand},
 list:{gap:11},
 card:{borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,borderRadius:16,alignItems:"center",padding:13,gap:12},
 tableIcon:{width:48,height:48,borderRadius:14,alignItems:"center",justifyContent:"center"},
 cardInfo:{flex:1,gap:5},
 cardHead:{alignItems:"center",justifyContent:"space-between",gap:8},
 cardName:{fontSize:17,fontWeight:"800",color:theme.ink,flexShrink:1},
 badge:{paddingVertical:4,paddingHorizontal:9,borderRadius:12},
 badgeText:{fontWeight:"800",fontSize:11},
 meta:{color:theme.muted,fontSize:12},
 center:{paddingVertical:65,alignItems:"center",gap:14},
 subtle:{fontSize:14,color:theme.muted,lineHeight:23},
 footer:{fontSize:12,color:theme.muted,marginTop:8},
 empty:{minHeight:230,alignItems:"center",justifyContent:"center",gap:13,paddingHorizontal:21},
 error:{backgroundColor:"#FFF0F0",borderWidth:1,borderColor:"#F6CAC9",borderRadius:14,padding:16,gap:10},
 errorText:{color:theme.danger,fontSize:13},
 retry:{fontWeight:"800",color:theme.brand},
});
