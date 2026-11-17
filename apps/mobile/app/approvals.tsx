import {useCallback,useState} from "react";
import {ActivityIndicator,FlatList,Pressable,RefreshControl,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useLocalSearchParams} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {direction} from "@dineflow/shared";
import {useLocale} from "../src/locale";
import {theme} from "../src/theme";
import {floorRequest} from "../src/floor-api";
import {gm7} from "../src/guest-copy";
import {type PendingGuest,type GuestApprovalPage,guestName} from "../src/guest-types";
import {price} from "../src/order-types";
import {m24} from "../src/mobile24-copy";
import {LiveNotice,LoadingPanel,EmptyPanel,Pager} from "../src/mobile23-ui";
import {useLiveScreen} from "../src/use-live-screen";
export default function Approvals(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl",safe=useSafeAreaInsets();
 const params=useLocalSearchParams<{tableId?:string}>();
 const [tableFilter,setTableFilter]=useState(params.tableId??""),[page,setPage]=useState(1);
 const loader=useCallback(()=>{
  const query=new URLSearchParams({status:"pending",page:String(page)});
  if(tableFilter)query.set("tableId",tableFilter);
  return floorRequest<GuestApprovalPage>("/api/guest/staff/approvals?"+query.toString());
 },[page,tableFilter]);
 const {data,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen(
  "guest-approvals-"+page+"-"+tableFilter,loader,10000);
 const header=<View style={styles.headerStack}>
  <View style={[styles.header,{paddingTop:safe.top+12,flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable accessibilityRole="button" onPress={()=>router.back()}
    accessibilityLabel={gm7(locale,"back")} style={styles.icon}>
    <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={22} color={theme.brand}/></Pressable>
   <View style={styles.heading}><Text style={[styles.caption,{textAlign:rtl?"right":"left"}]}>
    DINEFLOW / GUEST</Text>
    <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{gm7(locale,"approvals")}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel={gm7(locale,"refresh")}
    onPress={()=>void refresh(true)} disabled={refreshing} style={styles.icon}>
    {refreshing?<ActivityIndicator size="small" color={theme.brand}/>:
     <Ionicons name="refresh-outline" size={21} color={theme.brand}/>}</Pressable>
  </View>
  <LiveNotice locale={locale} error={error} lastUpdated={lastUpdated}
   hasData={!!data} onRetry={()=>void refresh(true)}/>
  {!!tableFilter&&<View style={[styles.filter,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Ionicons name="filter-outline" size={20} color={theme.brand}/>
    <Text style={styles.filterLabel}>{m24(locale,"searchHint")}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={m24(locale,"showAll")}
     onPress={()=>{setTableFilter("");setPage(1);}} style={styles.filterClear}>
     <Text style={styles.filterClearText}>{m24(locale,"showAll")}</Text></Pressable>
   </View>}
  <View style={[styles.summary,{flexDirection:rtl?"row-reverse":"row"}]}>
   <View style={styles.summaryIcon}><Ionicons name="receipt-outline" size={23} color={theme.brand}/></View>
   <View style={styles.summaryBody}>
    <Text style={[styles.summaryLabel,{textAlign:rtl?"right":"left"}]}>{gm7(locale,"pendingCount")}</Text>
    <Text style={styles.summaryNumber}>{data?.total??"—"}</Text>
   </View>
  </View>
 </View>;
 function render({item}:{item:PendingGuest}){
  return <Pressable accessibilityRole="button" onPress={()=>
   router.push({pathname:"/approvals/[id]",params:{id:item.id}})}
   style={styles.card}>
   <View style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Text style={[styles.table,{textAlign:rtl?"right":"left"}]}>
     {gm7(locale,"table")} {item.tableLabel}</Text>
    <View style={styles.badge}><Text style={styles.badgeText}>{gm7(locale,"pending")}</Text></View>
   </View>
   <Text style={[styles.description,{textAlign:rtl?"right":"left"}]}>
    {item.preview.slice(0,3).map(row=>row.quantity+" × "+guestName(row,locale)).join(" · ")}</Text>
   <View style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.total}><Text style={styles.money}>{price(item.estimatedMinor,locale)}</Text>
     <Text style={styles.date}>{new Date(item.createdAt).toLocaleString(locale)}</Text></View>
    <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={20} color={theme.brand}/>
   </View>
  </Pressable>;
 }
 return <FlatList style={styles.root} data={data?.items??[]} keyExtractor={item=>item.id}
  renderItem={render} contentContainerStyle={styles.content}
  ListHeaderComponent={header}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh(true)}
   tintColor={theme.brand}/>}
  ListEmptyComponent={loading?<LoadingPanel locale={locale} label={gm7(locale,"loading")}/>:
   <EmptyPanel locale={locale} icon="shield-checkmark-outline" title={gm7(locale,"noPending")}
    onAction={error?()=>void refresh(true):undefined} actionLabel={gm7(locale,"retry")}/>}
  ListFooterComponent={<Pager locale={locale} page={page} total={data?.total??0}
   perPage={data?.perPage??10} disabled={loading||refreshing} onChange={setPage}/>} />;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},
 content:{paddingHorizontal:17,paddingBottom:35,gap:11},
 headerStack:{gap:16,marginBottom:6},
 header:{gap:11,alignItems:"center"},
 icon:{height:44,width:44,backgroundColor:theme.brandSoft,borderRadius:13,
  alignItems:"center",justifyContent:"center"},
 heading:{flex:1,gap:3,minWidth:0},
 caption:{fontSize:10,fontWeight:"900",letterSpacing:1,color:theme.brand},
 title:{fontSize:22,color:theme.ink,fontWeight:"900"},
 filter:{gap:8,alignItems:"center",backgroundColor:theme.brandSoft,borderRadius:12,padding:13},
 filterLabel:{flex:1,color:theme.brand,fontSize:12,fontWeight:"700"},
 filterClear:{minHeight:35,justifyContent:"center",paddingHorizontal:10},
 filterClearText:{color:theme.brand,fontWeight:"900",fontSize:12},
 summary:{backgroundColor:"#F0F9F3",borderWidth:1,borderColor:"#D9EADD",
  borderRadius:14,padding:16,gap:11,alignItems:"center"},
 summaryIcon:{height:44,width:44,borderRadius:13,backgroundColor:"#fff",
  alignItems:"center",justifyContent:"center"},
 summaryBody:{flex:1,gap:3},
 summaryLabel:{fontSize:12,color:theme.brand,fontWeight:"800"},
 summaryNumber:{fontSize:24,fontWeight:"900",color:theme.ink},
 card:{backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderTopWidth:3,
  borderColor:theme.border,borderTopColor:"#D9A94E",padding:17,gap:13},
 row:{alignItems:"center",justifyContent:"space-between",gap:9},
 table:{fontSize:17,fontWeight:"900",color:theme.ink,flex:1},
 badge:{paddingHorizontal:10,paddingVertical:7,borderRadius:99,backgroundColor:"#FFF2DD"},
 badgeText:{fontSize:11,fontWeight:"800",color:"#916020"},
 description:{fontSize:13,lineHeight:21,color:theme.muted},
 total:{flex:1,gap:5},
 money:{fontSize:17,fontWeight:"900",color:theme.brand},
 date:{fontSize:11,color:theme.muted},
});
