import {useCallback,useEffect,useState} from "react";
import {FlatList,Pressable,RefreshControl,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useLocalSearchParams} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {floorRequest} from "../../src/floor-api";
import {o5} from "../../src/order-copy";
import {price,type OrderSummary,type Page} from "../../src/order-types";
import {m23} from "../../src/mobile23-copy";
import {LiveNotice,LoadingPanel,EmptyPanel,Pager,ScreenHeader,SectionHeading,Pill} from "../../src/mobile23-ui";
import {useLiveScreen} from "../../src/use-live-screen";
import {orderTab} from "../../src/mobile23-data";
type Status="active"|"ready"|"completed";
const statuses:Status[]=["active","ready","completed"];
export default function Orders(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const params=useLocalSearchParams<{tab?:string}>();
 const [status,setStatus]=useState<Status>("active"),[page,setPage]=useState(1);
 useEffect(()=>{
  const next=orderTab(params.tab);
  setStatus(next);setPage(1);
 },[params.tab]);
 const loader=useCallback(()=>floorRequest<Page<OrderSummary>>(
  "/api/orders/my?status="+status+"&page="+page),[status,page]);
 const {data,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen(
  "orders-"+status+"-"+page,loader,12000);
 const select=(next:Status)=>{if(status===next)return;setStatus(next);setPage(1);};
 const header=<View style={styles.headerStack}>
  <ScreenHeader locale={locale} title={m23(locale,"orders")} caption="DINEFLOW / KITCHEN"
   subtitle={m23(locale,"orderDescription")} onRefresh={()=>void refresh(true)} refreshing={refreshing}/>
  <LiveNotice locale={locale} error={error} lastUpdated={lastUpdated} hasData={!!data}
   onRetry={()=>void refresh(true)}/>
  <View style={[styles.tabs,{flexDirection:rtl?"row-reverse":"row"}]}>
   {statuses.map(s=><Pressable key={s} accessibilityRole="tab"
    accessibilityState={{selected:status===s}} onPress={()=>select(s)}
    style={[styles.tab,status===s&&styles.tabOn]}>
    <Text style={[styles.tabText,status===s&&styles.tabTextOn]}>{o5(locale,s)}</Text>
   </Pressable>)}
  </View>
  <View style={styles.summary}>
   <View style={[styles.summaryLine,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Ionicons name={status==="ready"?"checkmark-circle-outline":status==="completed"?
     "shield-checkmark-outline":"receipt-outline"} size={20} color={theme.brand}/>
    <View style={styles.summaryInfo}>
     <Text style={[styles.summaryTitle,{textAlign:rtl?"right":"left"}]}>{m23(locale,"orderList")}</Text>
     <Text style={[styles.summaryHint,{textAlign:rtl?"right":"left"}]}>
      {status==="ready"?m23(locale,"readyInstruction"):status==="completed"?
       o5(locale,"completedHint"):o5(locale,"listHint")}</Text>
    </View>
    <Text style={styles.summaryCount}>{data?.total??"—"}</Text>
   </View>
  </View>
  <SectionHeading locale={locale} title={o5(locale,status)}
    icon={status==="ready"?"checkmark-circle-outline":"list-outline"}/>
 </View>;
 function render({item}:{item:OrderSummary}){
  const served=["ready","picked_up","served"].includes(item.status);
  return <Pressable accessibilityRole="button" accessibilityLabel={o5(locale,"table")+" "+item.tableLabel+
    ", "+o5(locale,item.status)}
    onPress={()=>router.push({pathname:"/order/[id]",params:{id:item.id}})}
    style={styles.card}>
    <View style={[styles.cardTop,{flexDirection:rtl?"row-reverse":"row"}]}>
     <View style={styles.cardIdentity}>
      <View style={styles.cardIcon}><Ionicons name="receipt-outline" size={22} color={theme.brand}/></View>
      <View style={styles.cardMain}><Text style={[styles.table,{textAlign:rtl?"right":"left"}]}>
        {o5(locale,"table")} {item.tableLabel}</Text>
       <Text style={[styles.round,{textAlign:rtl?"right":"left"}]}>
        {o5(locale,"round")} #{item.roundNumber}</Text></View>
     </View>
     <View style={[styles.badge,served?styles.badgeReady:styles.badgeWorking]}>
      <Text style={[styles.badgeText,{color:served?theme.brand:"#8F6525"}]}>{o5(locale,item.status)}</Text>
     </View>
    </View>
    <Text style={[styles.timestamp,{textAlign:rtl?"right":"left"}]}>
     {new Date(item.createdAt).toLocaleString(locale,{year:"numeric",month:"short",day:"numeric",
      hour:"2-digit",minute:"2-digit"})}</Text>
    <View style={[styles.cardBottom,{flexDirection:rtl?"row-reverse":"row"}]}>
     <View><Text style={styles.amountCaption}>{m23(locale,"total")}</Text>
      <Text style={styles.amount}>{price(item.totalMinor,locale)}</Text></View>
     <View style={[styles.open,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Text style={styles.openText}>{m23(locale,"orderOpen")}</Text>
      <Ionicons name={rtl?"arrow-back":"arrow-forward"} size={17} color={theme.brand}/>
     </View>
    </View>
   </Pressable>;
 }
 return <FlatList style={styles.root} data={data?.items??[]}
  keyExtractor={item=>item.id} renderItem={render}
  contentContainerStyle={styles.content} ListHeaderComponent={header}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh(true)}
   tintColor={theme.brand}/>}
  ListEmptyComponent={loading?<LoadingPanel locale={locale}/>:
   <EmptyPanel locale={locale} icon="receipt-outline" title={m23(locale,"noOrders")}
    hint={status==="completed"?o5(locale,"completedHint"):m23(locale,"orderDescription")}
    onAction={error?()=>void refresh(true):undefined}/>}
  ListFooterComponent={<Pager locale={locale} page={page} total={data?.total??0}
   perPage={data?.perPage??10} disabled={loading||refreshing} onChange={setPage}/>}
 />;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},
 content:{paddingHorizontal:17,paddingBottom:32,gap:12},
 headerStack:{gap:16,marginBottom:7},
 tabs:{padding:4,backgroundColor:"#EBF1ED",borderRadius:14,gap:4},
 tab:{flex:1,minHeight:45,alignItems:"center",justifyContent:"center",borderRadius:11},
 tabOn:{backgroundColor:"#fff",elevation:2},
 tabText:{fontSize:12,fontWeight:"800",color:theme.muted,textAlign:"center"},
 tabTextOn:{color:theme.brand},
 summary:{backgroundColor:theme.brandSoft,borderRadius:15,padding:15,borderWidth:1,borderColor:"#D2E5D8"},
 summaryLine:{alignItems:"center",gap:12},
 summaryInfo:{flex:1,gap:5},
 summaryTitle:{fontWeight:"850",color:theme.brand,fontSize:13},
 summaryHint:{fontSize:11,lineHeight:17,color:theme.muted},
 summaryCount:{fontSize:24,color:theme.brand,fontWeight:"900"},
 card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,borderRadius:17,padding:16,gap:11},
 cardTop:{alignItems:"center",justifyContent:"space-between",gap:12},
 cardIdentity:{flexDirection:"row",gap:10,alignItems:"center",flex:1,minWidth:0},
 cardIcon:{width:40,height:40,borderRadius:12,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center"},
 cardMain:{gap:3,flex:1},
 table:{fontSize:16,fontWeight:"900",color:theme.ink},
 round:{fontSize:12,color:theme.muted,fontWeight:"600"},
 badge:{borderRadius:99,paddingVertical:6,paddingHorizontal:10,flexShrink:1},
 badgeReady:{backgroundColor:"#E5F6ED"},
 badgeWorking:{backgroundColor:"#FFF4E3"},
 badgeText:{fontSize:11,fontWeight:"800",textAlign:"center"},
 timestamp:{fontSize:11,color:theme.muted},
 cardBottom:{borderTopWidth:1,borderTopColor:theme.border,paddingTop:12,
  alignItems:"center",justifyContent:"space-between",gap:9},
 amountCaption:{fontSize:10,color:theme.muted,fontWeight:"700"},
 amount:{fontSize:16,fontWeight:"900",color:theme.brand,marginTop:3},
 open:{alignItems:"center",gap:7},
 openText:{fontSize:11,fontWeight:"800",color:theme.brand},
});
