import {useCallback,useRef,useState} from "react";
import {ActivityIndicator,Alert,FlatList,Pressable,RefreshControl,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useLocalSearchParams} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {direction} from "@dineflow/shared";
import {floorRequest,FloorRequestError} from "../src/floor-api";
import {useLocale} from "../src/locale";
import {theme} from "../src/theme";
import {sr8,type ServiceList,type ServiceRequest} from "../src/service-copy";
import {m24} from "../src/mobile24-copy";
import {serviceActionAllowed} from "../src/mobile24-ops";
import {useLiveScreen} from "../src/use-live-screen";
import {LiveNotice,LoadingPanel,EmptyPanel,Pager,Pill} from "../src/mobile23-ui";
type ViewStatus="active"|"resolved";
export default function Requests(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl",safe=useSafeAreaInsets();
 const {tableId}=useLocalSearchParams<{tableId?:string}>();
 const [tab,setTab]=useState<ViewStatus>("active"),[page,setPage]=useState(1);
 const [tableFilter,setTableFilter]=useState(tableId??"");
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(""),[actionError,setActionError]=useState(""),[notice,setNotice]=useState("");
 const lock=useRef(false);
 // The backend filters both records and totals by the verified assigned visit and table ID.
 const loader=useCallback(()=>{
  const params=new URLSearchParams({status:tab,page:String(page)});
  if(tableFilter)params.set("tableId",tableFilter);
  return floorRequest<ServiceList>("/api/service/requests?"+params.toString());
 },[tab,page,tableFilter]);
 const {data,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen(
  "service-"+tab+"-"+page+"-"+tableFilter,loader,12000);
 const selectedTable=data?.items[0]?.tableLabel??null;
 function selectTab(next:ViewStatus){if(next!==tab){setTab(next);setPage(1);setNotice("");setActionError("");}}
 function clearFilter(){setTableFilter("");setPage(1);setNotice("");}
 const reload=()=>{setNotice("");setActionError("");void refresh(true);};
 function describeError(e:unknown){
  if(e instanceof FloorRequestError){
   if(e.status===401){router.replace("/sign-in");return m24(locale,"noPermission");}
   if(["VERSION_CONFLICT","ALREADY_HANDLED","VISIT_CLOSED"].includes(e.code))return m24(locale,"requestHandled");
   if(e.status===403)return m24(locale,"noPermission");
  }
  return e instanceof Error?e.message:sr8(locale,"error");
 }
 async function execute(item:ServiceRequest,action:"acknowledge"|"resolve"){
  if(lock.current||!serviceActionAllowed(item,action))return;
  lock.current=true;setBusy(item.id);setActionError("");setNotice("");
  try{
   await floorRequest("/api/service/requests/"+encodeURIComponent(item.id)+"/transition",
    {method:"POST",body:{version:item.version,action,note:notes[item.id]??""}});
   setNotes(prev=>{const next={...prev};delete next[item.id];return next;});
   setNotice(m24(locale,"requestUpdated"));await refresh(true);
  }catch(e){setActionError(describeError(e));await refresh(true);}
  finally{lock.current=false;setBusy("");}
 }
 function confirm(item:ServiceRequest,action:"acknowledge"|"resolve"){
  if(!serviceActionAllowed(item,action)||lock.current)return;
  if(action==="resolve"){
   Alert.alert(m24(locale,"resolve"),m24(locale,"confirmResolve"),[
    {text:m24(locale,"cancel"),style:"cancel"},
    {text:m24(locale,"confirm"),onPress:()=>void execute(item,action)}]);
  }else void execute(item,action);
 }
 function render({item}:{item:ServiceRequest}){
  const active=item.status==="pending"||item.status==="acknowledged";
  const requestIcon=item.type==="water"?"water-outline":item.type==="bill"?"receipt-outline":
   item.type==="cutlery"?"restaurant-outline":"notifications-outline";
  return <View style={styles.card}>
   <View style={[styles.itemHead,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.requestIcon}>
     <Ionicons name={requestIcon} size={23} color={theme.brand}/></View>
    <View style={styles.itemTitleWrap}>
     <Text style={[styles.itemTitle,{textAlign:rtl?"right":"left"}]}>
      {sr8(locale,item.type)} · {m24(locale,"searchTable")} {item.tableLabel}</Text>
     <Text style={[styles.received,{textAlign:rtl?"right":"left"}]}>
      {m24(locale,"created")} · {new Date(item.createdAt).toLocaleString(locale)}</Text>
    </View>
    <View style={[styles.statusBadge,item.status==="pending"?styles.pendingBadge:styles.resolvedBadge]}>
     <Text style={styles.statusText}>{sr8(locale,item.status==="pending"?"pending":
       item.status==="acknowledged"?"acknowledged":"resolved")}</Text></View>
   </View>
   {(!!item.note||item.type==="bill")&&<View style={styles.noteCard}>
    {item.type==="bill"&&<Text style={[styles.noteText,{textAlign:rtl?"right":"left"}]}>
      {sr8(locale,"billPreference")}: {sr8(locale,item.billPreference)}</Text>}
    {!!item.note&&<Text style={[styles.noteText,{textAlign:rtl?"right":"left"}]}>{item.note}</Text>}
   </View>}
   {!!item.resolutionNote&&<Text style={[styles.noteText,{textAlign:rtl?"right":"left"}]}>
    {sr8(locale,"note")}: {item.resolutionNote}</Text>}
   {active&&<View style={styles.actions}>
    <Text style={[styles.helper,{textAlign:rtl?"right":"left"}]}>
     {m24(locale,"resolutionHelp")}</Text>
    <TextInput accessibilityLabel={m24(locale,"resolutionNote")}
     value={notes[item.id]??""} onChangeText={text=>setNotes(prev=>({...prev,[item.id]:text}))}
     maxLength={200} multiline textAlignVertical="top" editable={!busy}
     placeholder={m24(locale,"resolutionNote")} placeholderTextColor={theme.muted}
     style={[styles.input,{textAlign:rtl?"right":"left"}]}/>
    <View style={[styles.actionRow,{flexDirection:rtl?"row-reverse":"row"}]}>
     {serviceActionAllowed(item,"acknowledge")&&<Pressable accessibilityRole="button"
       disabled={!!busy} onPress={()=>confirm(item,"acknowledge")}
       style={[styles.secondary,!!busy&&styles.disabled]}>
       <Ionicons name="checkmark-outline" color={theme.brand} size={18}/>
       <Text style={styles.secondaryText}>{m24(locale,"acknowledge")}</Text></Pressable>}
     {serviceActionAllowed(item,"resolve")&&<Pressable accessibilityRole="button"
       disabled={!!busy} onPress={()=>confirm(item,"resolve")}
       style={[styles.primary,!!busy&&styles.disabled]}>
       {busy===item.id?<ActivityIndicator color="#fff" size="small"/>:
        <Ionicons name="checkmark-done-outline" color="#fff" size={19}/>}
       <Text style={styles.primaryText}>{m24(locale,"resolve")}</Text></Pressable>}
    </View>
   </View>}
   <Pressable accessibilityRole="button" onPress={()=>
    router.push({pathname:"/table/[id]",params:{id:item.tableId}})}
    style={[styles.openTable,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Text style={styles.openTableText}>{m24(locale,"openTable")}</Text>
    <Ionicons name={rtl?"arrow-back":"arrow-forward"} size={17} color={theme.brand}/>
   </Pressable>
  </View>;
 }
 const header=<View style={styles.headerStack}>
  <View style={[styles.top,{paddingTop:safe.top+12,flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable accessibilityRole="button" accessibilityLabel={m24(locale,"backFloor")}
    style={styles.back} onPress={()=>router.back()}>
    <Ionicons name={rtl?"arrow-forward":"arrow-back"} color={theme.brand} size={21}/></Pressable>
   <View style={styles.heading}><Text style={[styles.caption,{textAlign:rtl?"right":"left"}]}>
    DINEFLOW / SERVICE</Text><Text style={[styles.headingTitle,{textAlign:rtl?"right":"left"}]}>
    {m24(locale,"requestsTitle")}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel={m24(locale,"refresh")}
    style={styles.back} onPress={reload} disabled={refreshing}>
    {refreshing?<ActivityIndicator color={theme.brand} size="small"/>:
     <Ionicons name="refresh-outline" color={theme.brand} size={21}/>}</Pressable>
  </View>
  <Text style={[styles.subtitle,{textAlign:rtl?"right":"left"}]}>{m24(locale,"requestsHelp")}</Text>
  <LiveNotice locale={locale} error={error||actionError} lastUpdated={lastUpdated}
   hasData={!!data} onRetry={reload}/>
  {!!notice&&<View accessibilityRole="alert" style={styles.success}>
   <Ionicons name="checkmark-circle-outline" size={19} color={theme.brand}/>
   <Text style={styles.successText}>{notice}</Text></View>}
  {tableFilter&&<View style={[styles.activeFilter,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Ionicons name="filter-outline" size={20} color={theme.brand}/>
   <View style={styles.filterBody}>
    <Text style={[styles.filterLabel,{textAlign:rtl?"right":"left"}]}>{m24(locale,"searchTable")}</Text>
    <Text numberOfLines={2} style={[styles.filterValue,{textAlign:rtl?"right":"left"}]}>
     {selectedTable??m24(locale,"filterTable")}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel={m24(locale,"showAll")}
    onPress={clearFilter} style={styles.clearFilter}><Ionicons name="close-circle-outline" size={21} color={theme.brand}/></Pressable>
  </View>}
  <View style={[styles.tabs,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable accessibilityRole="tab" accessibilityState={{selected:tab==="active"}}
    onPress={()=>selectTab("active")} style={[styles.tab,tab==="active"&&styles.tabOn]}>
    <Text style={[styles.tabText,tab==="active"&&styles.tabTextOn]}>{m24(locale,"activeRequests")}</Text>
   </Pressable>
   <Pressable accessibilityRole="tab" accessibilityState={{selected:tab==="resolved"}}
    onPress={()=>selectTab("resolved")} style={[styles.tab,tab==="resolved"&&styles.tabOn]}>
    <Text style={[styles.tabText,tab==="resolved"&&styles.tabTextOn]}>{m24(locale,"requestHistory")}</Text>
   </Pressable>
  </View>
  <View style={[styles.summary,{flexDirection:rtl?"row-reverse":"row"}]}>
   <View style={styles.summaryIcon}>
    <Ionicons name={tab==="active"?"notifications-outline":"checkmark-circle-outline"}
     size={21} color={theme.brand}/></View>
   <View style={styles.summaryBody}><Text style={[styles.summaryLabel,{textAlign:rtl?"right":"left"}]}>
    {m24(locale,"totalRequests")}</Text>
    <Text style={styles.summaryCount}>{data?.total??"—"}</Text></View>
  </View>
 </View>;
 return <FlatList style={styles.root} data={data?.items??[]}
  keyExtractor={item=>item.id} renderItem={render}
  contentContainerStyle={styles.content} ListHeaderComponent={header}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={theme.brand}/>}
  ListEmptyComponent={loading?<LoadingPanel locale={locale}/>:
   <EmptyPanel locale={locale} icon="checkmark-circle-outline"
    title={tab==="resolved"?m24(locale,"noHistory"):m24(locale,"emptyRequests")}
    onAction={error?reload:undefined} actionLabel={m24(locale,"retry")}/>}
  ListFooterComponent={<Pager locale={locale} page={page} total={data?.total??0}
   perPage={data?.perPage??20} disabled={loading||refreshing}
   onChange={setPage}/>} />;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},content:{paddingHorizontal:17,paddingBottom:34,gap:11},
 headerStack:{gap:15,marginBottom:7},
 top:{alignItems:"center",gap:11},back:{width:43,height:43,borderRadius:12,backgroundColor:theme.brandSoft,
  justifyContent:"center",alignItems:"center"},heading:{flex:1,gap:4,minWidth:0},
 caption:{color:theme.brand,fontWeight:"900",fontSize:10,letterSpacing:1},
 headingTitle:{fontWeight:"900",fontSize:22,color:theme.ink},
 subtitle:{fontSize:12,color:theme.muted,lineHeight:20},
 success:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:"#E8F7ED",padding:13,borderRadius:12},
 successText:{color:theme.brand,fontWeight:"800",fontSize:12,flex:1},
 activeFilter:{padding:13,borderRadius:13,backgroundColor:theme.brandSoft,
  borderWidth:1,borderColor:"#D3E7DB",gap:10,alignItems:"center"},
 filterBody:{flex:1,gap:4},filterLabel:{fontSize:10,color:theme.muted},
 filterValue:{fontSize:13,fontWeight:"800",color:theme.brand},
 clearFilter:{padding:6},
 tabs:{padding:5,backgroundColor:"#EAF1EC",borderRadius:13,gap:5},
 tab:{flex:1,minHeight:44,alignItems:"center",justifyContent:"center",borderRadius:10},
 tabOn:{backgroundColor:"#fff",elevation:2},
 tabText:{fontSize:12,fontWeight:"800",color:theme.muted,textAlign:"center"},
 tabTextOn:{color:theme.brand},
 summary:{alignItems:"center",padding:14,borderRadius:13,backgroundColor:"#fff",
  borderWidth:1,borderColor:theme.border,gap:11},
 summaryIcon:{height:44,width:44,borderRadius:13,backgroundColor:theme.brandSoft,
  justifyContent:"center",alignItems:"center"},
 summaryBody:{flex:1,gap:4},summaryLabel:{fontSize:11,fontWeight:"700",color:theme.muted},
 summaryCount:{fontSize:22,fontWeight:"900",color:theme.ink},
 card:{padding:16,backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,borderRadius:16,gap:13},
 itemHead:{gap:11,alignItems:"flex-start"},
 requestIcon:{height:43,width:43,borderRadius:13,backgroundColor:theme.brandSoft,
  alignItems:"center",justifyContent:"center"},
 itemTitleWrap:{flex:1,gap:6,minWidth:0},
 itemTitle:{fontSize:15,fontWeight:"900",color:theme.ink,lineHeight:22},
 received:{fontSize:11,color:theme.muted,lineHeight:16},
 statusBadge:{paddingHorizontal:9,paddingVertical:6,borderRadius:99,backgroundColor:"#EAF6EF"},
 pendingBadge:{backgroundColor:"#FFF4E3"},
 resolvedBadge:{backgroundColor:"#EAF6EF"},
 statusText:{fontSize:10,fontWeight:"800",color:theme.brand},
 noteCard:{padding:13,backgroundColor:"#F7FAF7",borderRadius:11,gap:7},
 noteText:{fontSize:12,color:theme.ink,lineHeight:19},
 actions:{gap:11},helper:{fontSize:12,color:theme.muted,lineHeight:19},
 input:{minHeight:50,backgroundColor:"#fff",borderColor:"#D4E4D8",borderWidth:1,
  borderRadius:11,padding:12,fontSize:13,color:theme.ink},
 actionRow:{gap:8,flexWrap:"wrap",alignItems:"center"},
 primary:{minHeight:44,backgroundColor:theme.brand,borderRadius:11,paddingHorizontal:13,
  flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center"},
 primaryText:{fontSize:12,fontWeight:"800",color:"#fff"},
 secondary:{minHeight:44,backgroundColor:theme.brandSoft,borderWidth:1,borderColor:"#D4E9DC",
  borderRadius:11,paddingHorizontal:13,flexDirection:"row",alignItems:"center",gap:7,justifyContent:"center"},
 secondaryText:{fontSize:12,fontWeight:"800",color:theme.brand},
 disabled:{opacity:.45},
 openTable:{borderTopWidth:1,borderTopColor:theme.border,paddingTop:11,alignItems:"center",gap:7},
 openTableText:{fontSize:12,fontWeight:"800",color:theme.brand},
});
