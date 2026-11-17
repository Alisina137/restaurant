import {useCallback,useMemo,useState} from "react";
import {FlatList,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router} from "expo-router";
import {Ionicons} from "@expo/vector-icons";
import {direction,type Locale} from "@dineflow/shared";
import {floorRequest} from "../../src/floor-api";
import {f,type Board,type Status,type Table} from "../../src/floor";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {o5} from "../../src/order-copy";
import {sr8,type ServiceList,type ServiceRequest} from "../../src/service-copy";
import {type Page,type OrderSummary,price} from "../../src/order-types";
import {m23} from "../../src/mobile23-copy";
import {ScreenHeader,LiveNotice,LoadingPanel,EmptyPanel,Pill,SectionHeading} from "../../src/mobile23-ui";
import {useLiveScreen} from "../../src/use-live-screen";
type Tab="all"|"mine"|"attention";
type FloorData={board:Board;ready:Page<OrderSummary>|null;requests:ServiceList|null};
type Row={kind:"table";table:Table}|{kind:"section";id:string;label:string}|
 {kind:"ready";order:OrderSummary}|{kind:"request";request:ServiceRequest};
const statuses:Status[]=["available","occupied","cleaning","disabled"];
async function loadTables():Promise<FloorData>{
 const [board,ready,requests]=await Promise.allSettled([
  floorRequest<Board>("/api/floor/tables/board"),
  floorRequest<Page<OrderSummary>>("/api/orders/my?status=ready&page=1"),
  floorRequest<ServiceList>("/api/service/requests?status=active&page=1")
 ]);
 if(board.status==="rejected")throw board.reason;
 return {board:board.value,
  ready:ready.status==="fulfilled"?ready.value:null,
  requests:requests.status==="fulfilled"?requests.value:null};
}
export default function Tables(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [tab,setTab]=useState<Tab>("all"),[status,setStatus]=useState<Status|null>(null),
  [section,setSection]=useState(""),[query,setQuery]=useState("");
 const loader=useCallback(loadTables,[]);
 const {data,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen("floor-live",loader,12000);
 const board=data?.board;
 const counts=useMemo(()=>{
  const items=board?.tables??[];
  return {all:items.length,mine:items.filter(t=>t.assignedWaiterId===board?.actorId).length,
   available:items.filter(t=>t.status==="available").length,
   occupied:items.filter(t=>t.status==="occupied").length,
   cleaning:items.filter(t=>t.status==="cleaning").length,
   disabled:items.filter(t=>t.status==="disabled").length};
 },[board]);
 const visible=useMemo(()=>board?.tables.filter(t=>
  (tab!=="mine"||t.assignedWaiterId===board.actorId)&&
  (!status||t.status===status)&&(!section||t.sectionId===section)&&
  (!query.trim()||[t.label,t.sectionName,t.assignedWaiterName??""].some(v=>
   v.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))))??[],
 [board,tab,status,section,query]);
 const rows=useMemo<Row[]>(()=>{
  if(!board)return [];
  if(tab==="attention")return [
   ...(data?.requests?.items??[]).map(request=>({kind:"request" as const,request})),
   ...(data?.ready?.items??[]).map(order=>({kind:"ready" as const,order}))
  ];
  const result:Row[]=[];
  for(const s of board.sections){
   const items=visible.filter(t=>t.sectionId===s.id);
   if(items.length){result.push({kind:"section",id:s.id,label:s.name});
    for(const table of items)result.push({kind:"table",table});}
  }
  const known=new Set(board.sections.map(x=>x.id));
  const remaining=visible.filter(t=>!known.has(t.sectionId));
  for(const t of remaining)result.push({kind:"table",table:t});
  return result;
 },[board,data,tab,visible]);
 const attentionTotal=(data?.requests?.total??0)+(data?.ready?.total??0);
 const reset=()=>{setStatus(null);setSection("");setQuery("");};
 const filtered=!!status||!!section||!!query.trim();
 const switchTab=(next:Tab)=>{setTab(next);setStatus(null);setSection("");setQuery("");};
 const header=<View style={styles.headerStack}>
  <ScreenHeader locale={locale} title={m23(locale,"floor")} caption="DINEFLOW / SERVICE"
   subtitle={m23(locale,"fromFloor")} onRefresh={()=>void refresh(true)} refreshing={refreshing}/>
  <LiveNotice locale={locale} error={error} lastUpdated={lastUpdated}
    hasData={!!data} onRetry={()=>void refresh(true)}/>
  <View style={styles.summary}>
   <View style={[styles.summaryItem,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.summaryIcon}><Ionicons name="restaurant-outline" size={18} color={theme.brand}/></View>
    <View><Text style={styles.summaryNum}>{counts.occupied}</Text><Text style={styles.summaryText}>{f(locale,"occupied")}</Text></View>
   </View>
   <View style={[styles.summaryItem,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.summaryIcon}><Ionicons name="checkmark-circle-outline" size={18} color={theme.brand}/></View>
    <View><Text style={styles.summaryNum}>{counts.available}</Text><Text style={styles.summaryText}>{f(locale,"available")}</Text></View>
   </View>
   <View style={[styles.summaryItem,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.summaryIcon}><Ionicons name="alert-circle-outline" size={18} color="#A66F28"/></View>
    <View><Text style={styles.summaryNum}>{attentionTotal}</Text><Text style={styles.summaryText}>{m23(locale,"attention")}</Text></View>
   </View>
  </View>
  <View style={[styles.tabs,{flexDirection:rtl?"row-reverse":"row"}]}>
   {(["all","mine","attention"] as const).map(key=><Pressable key={key} accessibilityRole="tab"
    accessibilityState={{selected:tab===key}} onPress={()=>switchTab(key)}
    style={[styles.tab,tab===key&&styles.tabSelected]}>
    <Text style={[styles.tabText,tab===key&&styles.tabTextSelected]}>{m23(locale,key)}</Text>
   </Pressable>)}
  </View>
  {tab!=="attention"&&<View style={styles.filterStack}>
   <View style={[styles.searchBox,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Ionicons name="search-outline" size={19} color={theme.muted}/>
    <TextInput value={query} onChangeText={setQuery} placeholder={m23(locale,"searchTables")}
     accessibilityLabel={m23(locale,"searchTables")} placeholderTextColor={theme.muted}
     autoCorrect={false} style={[styles.search,{textAlign:rtl?"right":"left"}]}/>
    {query.length>0&&<Pressable accessibilityRole="button" accessibilityLabel={m23(locale,"clear")}
      onPress={()=>setQuery("")}><Ionicons name="close-circle" size={20} color={theme.muted}/></Pressable>}
   </View>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
    <Pill locale={locale} label={m23(locale,"allStates")} count={tab==="all"?counts.all:counts.mine}
     selected={!status} onPress={()=>setStatus(null)}/>
    {statuses.map(st=><Pill key={st} locale={locale} label={f(locale,st)} selected={status===st}
     count={board?.tables.filter(t=>t.status===st&&(tab!=="mine"||t.assignedWaiterId===board.actorId)).length??0}
     onPress={()=>setStatus(st)}/>)}
   </ScrollView>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
    <Pill locale={locale} label={m23(locale,"selectSection")} selected={!section} onPress={()=>setSection("")}/>
    {board?.sections.map(s=><Pill key={s.id} locale={locale} label={s.name}
     selected={section===s.id} onPress={()=>setSection(s.id)}/>)}
   </ScrollView>
   <View style={[styles.results,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Text style={styles.resultText}>{m23(locale,"matching")} · {visible.length} {m23(locale,"tablesShown")}</Text>
    {filtered&&<Pressable accessibilityRole="button" style={styles.reset} onPress={reset}>
      <Ionicons name="refresh-outline" size={16} color={theme.brand}/>
      <Text style={styles.resetText}>{m23(locale,"resetFilters")}</Text></Pressable>}
   </View>
  </View>}
  {tab==="attention"&&<View style={styles.attentionIntro}>
   <Text style={[styles.attentionHint,{textAlign:rtl?"right":"left"}]}>{m23(locale,"cleanAndRequests")}</Text>
   <Pressable accessibilityRole="button" onPress={()=>router.push("/requests")} style={styles.attentionLink}>
    <Text style={styles.attentionLinkText}>{m23(locale,"goRequests")}</Text>
    <Ionicons name={rtl?"arrow-back":"arrow-forward"} size={17} color={theme.brand}/></Pressable>
  </View>}
 </View>;
 const render=({item}:{item:Row})=>{
  if(item.kind==="section")return <SectionHeading locale={locale} title={item.label} icon="layers-outline"/>;
  if(item.kind==="request")return <Pressable accessibilityRole="button" onPress={()=>router.push("/requests")}
   style={[styles.card,styles.alertCard,{flexDirection:rtl?"row-reverse":"row"}]}>
   <View style={styles.alertIcon}><Ionicons name="notifications-outline" size={23} color="#A06B2C"/></View>
   <View style={styles.cardInfo}><Text style={[styles.cardTitle,{textAlign:rtl?"right":"left"}]}>
    {sr8(locale,item.request.type)} · {m23(locale,"table")} {item.request.tableLabel}</Text>
    <Text style={[styles.meta,{textAlign:rtl?"right":"left"}]}>{sr8(locale,item.request.status==="pending"?"pending":"acknowledged")}</Text>
   </View><Ionicons name={rtl?"chevron-back":"chevron-forward"} size={20} color={theme.brand}/></Pressable>;
  if(item.kind==="ready")return <Pressable accessibilityRole="button"
   onPress={()=>router.push({pathname:"/order/[id]",params:{id:item.order.id}})}
   style={[styles.card,styles.readyCard,{flexDirection:rtl?"row-reverse":"row"}]}>
   <View style={styles.tableIcon}><Ionicons name="checkmark-circle-outline" size={23} color={theme.brand}/></View>
   <View style={styles.cardInfo}><Text style={[styles.cardTitle,{textAlign:rtl?"right":"left"}]}>
    {m23(locale,"readyAlert")} · {m23(locale,"table")} {item.order.tableLabel}</Text>
    <Text style={[styles.meta,{textAlign:rtl?"right":"left"}]}>{o5(locale,"round")} #{item.order.roundNumber} · {price(item.order.totalMinor,locale)}</Text>
   </View><Ionicons name={rtl?"chevron-back":"chevron-forward"} size={20} color={theme.brand}/></Pressable>;
  return <TableRow table={item.table} locale={locale} rtl={rtl}
   isMine={item.table.assignedWaiterId===board?.actorId}/>;
 };
 return <FlatList style={styles.root} data={rows}
  keyExtractor={item=>item.kind==="table"?"table:"+item.table.id:
   item.kind==="section"?"section:"+item.id:
    item.kind==="ready"?"ready:"+item.order.id:"request:"+item.request.id}
  renderItem={render} ListHeaderComponent={header}
  contentContainerStyle={styles.content}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh(true)} tintColor={theme.brand}/>}
  ListEmptyComponent={loading?<LoadingPanel locale={locale}/>:
   <EmptyPanel locale={locale} icon={tab==="attention"?"checkmark-circle-outline":"grid-outline"}
    title={tab==="attention"?m23(locale,"noAttention"):
     filtered?m23(locale,"emptyFilter"):tab==="mine"?m23(locale,"noMyTables"):m23(locale,"noTables")}
    hint={tab==="attention"?m23(locale,"readyInstruction"):undefined}
    onAction={filtered?reset:!data?()=>void refresh(true):undefined}
    actionLabel={filtered?m23(locale,"resetFilters"):m23(locale,"retry")}/>}
  ListFooterComponent={tab==="attention"&&attentionTotal>rows.length?<Pressable accessibilityRole="button"
    onPress={()=>router.push({pathname:"/(main)/orders",params:{tab:"ready"}})}
    style={styles.footerAction}><Text style={styles.footerActionText}>{m23(locale,"viewReady")}</Text></Pressable>:null}
 />;
}
function TableRow({table,locale,rtl,isMine}:{table:Table;locale:Locale;rtl:boolean;isMine:boolean}){
 const tint=table.status==="occupied"?"#9D6921":table.status==="cleaning"?"#566FBA":
  table.status==="disabled"?theme.muted:theme.brand;
 const background=table.status==="occupied"?"#FFF5E5":table.status==="cleaning"?"#F0F1FC":
  table.status==="disabled"?"#F1F3F1":theme.brandSoft;
 return <Pressable onPress={()=>router.push({pathname:"/table/[id]",params:{id:table.id}})}
  accessibilityRole="button" accessibilityLabel={table.label+", "+f(locale,table.status)}
  style={[styles.card,{flexDirection:rtl?"row-reverse":"row"}]}>
  <View style={[styles.tableIcon,{backgroundColor:background}]}>
   <Ionicons name="restaurant-outline" color={tint} size={22}/></View>
  <View style={styles.cardInfo}>
   <View style={[styles.cardTop,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Text numberOfLines={1} style={[styles.cardTitle,{textAlign:rtl?"right":"left"}]}>{table.label}</Text>
    <View style={[styles.badge,{backgroundColor:background}]}>
     <Text style={[styles.badgeText,{color:tint}]}>{f(locale,table.status)}</Text></View>
   </View>
   <Text numberOfLines={1} style={[styles.meta,{textAlign:rtl?"right":"left"}]}>
    {table.sectionName} · {table.visitPartySize??table.seats} {f(locale,table.visitId?"guests":"seats")}</Text>
   <Text numberOfLines={1} style={[styles.meta,{textAlign:rtl?"right":"left"}]}>
    {isMine?m23(locale,"mine"):table.assignedWaiterName??f(locale,"unassigned")}</Text>
  </View>
  <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={19} color={theme.muted}/>
 </Pressable>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},
 content:{paddingHorizontal:17,paddingBottom:34,gap:11},
 headerStack:{gap:14,marginBottom:8},
 summary:{flexDirection:"row",gap:8},
 summaryItem:{flex:1,minWidth:0,alignItems:"center",gap:7,padding:9,
  borderColor:theme.border,borderWidth:1,borderRadius:13,backgroundColor:"#fff"},
 summaryIcon:{width:30,height:30,borderRadius:10,backgroundColor:theme.brandSoft,
  justifyContent:"center",alignItems:"center"},
 summaryNum:{fontSize:18,fontWeight:"900",color:theme.ink},
 summaryText:{fontSize:10,color:theme.muted,fontWeight:"800"},
 tabs:{padding:4,borderRadius:13,backgroundColor:"#E9F0EB",gap:4},
 tab:{flex:1,paddingVertical:12,borderRadius:10,alignItems:"center"},
 tabSelected:{backgroundColor:"#fff",elevation:2},
 tabText:{fontSize:12,fontWeight:"800",color:theme.muted,textAlign:"center"},
 tabTextSelected:{color:theme.brand},
 filterStack:{gap:12},
 searchBox:{alignItems:"center",gap:10,paddingHorizontal:13,height:49,
  backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,borderRadius:12},
 search:{flex:1,color:theme.ink,fontSize:14},
 chips:{alignItems:"center",gap:8,paddingVertical:3},
 results:{alignItems:"center",justifyContent:"space-between",gap:8},
 resultText:{fontSize:11,fontWeight:"800",color:theme.muted},
 reset:{flexDirection:"row",gap:5,alignItems:"center"},
 resetText:{fontSize:11,fontWeight:"800",color:theme.brand},
 attentionIntro:{gap:8,backgroundColor:theme.brandSoft,borderRadius:13,padding:14},
 attentionHint:{fontSize:12,color:theme.brand,lineHeight:20,fontWeight:"600"},
 attentionLink:{flexDirection:"row",alignItems:"center",gap:7},
 attentionLinkText:{fontSize:12,fontWeight:"850",color:theme.brand},
 card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,borderRadius:15,
  alignItems:"center",gap:11,padding:13,minHeight:91},
 alertCard:{backgroundColor:"#FFFCF5",borderColor:"#E7D7BC"},
 readyCard:{backgroundColor:"#F8FEFA",borderColor:"#B8E1C9"},
 tableIcon:{height:43,width:43,borderRadius:12,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center"},
 alertIcon:{height:43,width:43,borderRadius:12,backgroundColor:"#FFF1DD",alignItems:"center",justifyContent:"center"},
 cardInfo:{flex:1,minWidth:0,gap:6},
 cardTop:{alignItems:"center",gap:8},
 cardTitle:{fontSize:15,fontWeight:"850",color:theme.ink,flex:1},
 meta:{fontSize:11,color:theme.muted,lineHeight:17},
 badge:{borderRadius:8,paddingVertical:5,paddingHorizontal:8},
 badgeText:{fontWeight:"800",fontSize:10},
 footerAction:{minHeight:49,backgroundColor:theme.brand,borderRadius:12,alignItems:"center",justifyContent:"center"},
 footerActionText:{fontWeight:"800",color:"#fff",fontSize:13},
});
