import {useCallback,useMemo} from "react";
import {Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import {direction,t} from "@dineflow/shared";
import {fetchIdentity,type Identity} from "../../src/api";
import {theme} from "../../src/theme";
import {useLocale} from "../../src/locale";
import {FloorRequestError,floorRequest} from "../../src/floor-api";
import {type Board} from "../../src/floor";
import {useLiveScreen} from "../../src/use-live-screen";
import {ScreenHeader,LiveNotice,MetricCard,QuickLink,EmptyPanel,SectionHeading,LoadingPanel} from "../../src/mobile23-ui";
import {m23} from "../../src/mobile23-copy";
type Alert={id:string;roundId:string;tableLabel:string;lastNotifiedAt:string};
type HomeData={identity:Identity;board:Board;orders:{active:number;ready:number}|null;
 services:number|null;approvals:number|null;unread:number|null;alerts:Alert[]};
async function loadHome():Promise<HomeData>{
 let identity:Identity;
 try{identity=await fetchIdentity();}
 catch(err){if(String(err).includes("401"))throw new FloorRequestError(401,"UNAUTHENTICATED","Sign in again.");
  throw err;}
 if(identity.role!=="waiter")throw new FloorRequestError(403,"ACCESS_DENIED","ACCESS_DENIED");
 const [floor,orders,services,approvals,alerts]=await Promise.allSettled([
  floorRequest<Board>("/api/floor/tables/board"),
  floorRequest<{active:number;ready:number}>("/api/orders/my/stats"),
  floorRequest<{active:number}>("/api/service/requests/count"),
  floorRequest<{pending:number}>("/api/guest/staff/approvals/count"),
  floorRequest<{items:Alert[];unread:number}>("/api/orders/notifications?unread=1&page=1")
 ]);
 if(floor.status==="rejected")throw floor.reason;
 return {identity,board:floor.value,
  orders:orders.status==="fulfilled"?orders.value:null,
  services:services.status==="fulfilled"?services.value.active:null,
  approvals:approvals.status==="fulfilled"?approvals.value.pending:null,
  unread:alerts.status==="fulfilled"?alerts.value.unread:null,
  alerts:alerts.status==="fulfilled"?alerts.value.items.slice(0,3):[]};
}
export default function Home(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const loader=useCallback(loadHome,[]);
 const {data,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen("waiter-home",loader,12000);
 const mine=useMemo(()=>data?.board.tables.filter(table=>table.status==="occupied"&&
  table.assignedWaiterId===data.board.actorId).length??null,[data]);
 const openTable=()=>router.push("/(main)/tables");
 const openOrders=()=>router.push("/(main)/orders");
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh(true)} tintColor={theme.brand}/>}>
  <ScreenHeader locale={locale} title={t(locale,"home")} caption="DINEFLOW / WAITER"
   subtitle={m23(locale,"overviewDescription")} onRefresh={()=>void refresh(true)} refreshing={refreshing}
   action={<Pressable accessibilityRole="button" accessibilityLabel={m23(locale,"notifications")}
    onPress={()=>router.push("/notifications")} style={styles.bell}>
     <Ionicons name="notifications-outline" size={21} color={theme.brand}/>
     {!!data?.unread&&data.unread>0&&<View style={styles.dot}/>}
   </Pressable>}/>
  <LiveNotice locale={locale} error={error==="ACCESS_DENIED"?m23(locale,"noRole"):error}
   lastUpdated={lastUpdated} hasData={!!data} onRetry={()=>void refresh(true)}/>
  {loading&&!data?<LoadingPanel locale={locale}/>:
   data?<>
    <View style={styles.hero}>
     <View style={[styles.heroCap,{flexDirection:rtl?"row-reverse":"row"}]}>
      <View style={[styles.heroTag,{flexDirection:rtl?"row-reverse":"row"}]}>
       <Ionicons name="radio-button-on" color="#85DBC0" size={13}/>
       <Text style={styles.heroTagText}>{m23(locale,"shift")}</Text>
      </View>
      <Ionicons name="restaurant-outline" color="#B1DACA" size={25}/>
     </View>
     <Text style={[styles.heroTitle,{textAlign:rtl?"right":"left"}]}>
      {t(locale,"welcome")}{data.identity.user.name?", "+data.identity.user.name:""}</Text>
     <Text style={[styles.heroDescription,{textAlign:rtl?"right":"left"}]}>{m23(locale,"workspace")}</Text>
     <View style={[styles.heroRestaurant,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Ionicons name="storefront-outline" size={17} color="#C8EFDB"/>
      <Text numberOfLines={2} style={styles.heroRestaurantText}>{data.identity.tenantName??m23(locale,"unknown")}</Text>
     </View>
    </View>
    <SectionHeading locale={locale} title={m23(locale,"overview")} icon="pulse-outline"/>
    <View style={styles.metricGrid}>
     <View style={styles.metricRow}>
      <MetricCard locale={locale} value={mine} label={m23(locale,"myTables")}
       icon="grid-outline" onPress={openTable}/>
      <MetricCard locale={locale} value={data.orders?.ready??null} label={m23(locale,"readyFood")}
       icon="checkmark-circle-outline" kind="ready"
       onPress={()=>router.push({pathname:"/(main)/orders",params:{tab:"ready"}})}/>
     </View>
     <View style={styles.metricRow}>
      <MetricCard locale={locale} value={data.services} label={m23(locale,"openRequests")}
       icon="notifications-outline" kind={data.services?"attention":"normal"} onPress={()=>router.push("/requests")}/>
      <MetricCard locale={locale} value={data.approvals} label={m23(locale,"approvals")}
       icon="people-outline" kind={data.approvals?"attention":"normal"} onPress={()=>router.push("/approvals")}/>
     </View>
     <View style={styles.metricRow}>
      <MetricCard locale={locale} value={data.orders?.active??null} label={m23(locale,"activeOrders")}
       icon="receipt-outline" onPress={openOrders}/>
      <MetricCard locale={locale} value={data.unread} label={m23(locale,"unread")}
       icon="mail-unread-outline" kind={data.unread?"attention":"normal"}
       onPress={()=>router.push("/notifications")}/>
     </View>
    </View>
    <SectionHeading locale={locale} title={m23(locale,"quickActions")} icon="flash-outline"/>
    <View style={styles.links}>
     <QuickLink locale={locale} label={m23(locale,"openMyTables")} description={m23(locale,"fromFloor")}
      icon="restaurant-outline" onPress={openTable}/>
     <QuickLink locale={locale} label={m23(locale,"goRequests")} description={m23(locale,"serviceHint")}
      icon="hand-left-outline" onPress={()=>router.push("/requests")} badge={data.services}/>
     <QuickLink locale={locale} label={m23(locale,"goApprovals")} description={m23(locale,"approvalsHint")}
      icon="checkmark-done-circle-outline" onPress={()=>router.push("/approvals")} badge={data.approvals}/>
     <QuickLink locale={locale} label={m23(locale,"goMenu")} description={m23(locale,"menuDescription")}
      icon="book-outline" onPress={()=>router.push("/(main)/menu")}/>
    </View>
    <SectionHeading locale={locale} title={m23(locale,"alerts")} icon="notifications-outline"
     actionLabel={m23(locale,"seeNotifications")} onAction={()=>router.push("/notifications")}/>
    {data.alerts.length?<View style={styles.alertList}>{data.alerts.map(alert=>
      <QuickLink key={alert.id} locale={locale} label={m23(locale,"readyAlert")+" · "+m23(locale,"table")+" "+alert.tableLabel}
       description={new Date(alert.lastNotifiedAt).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})}
       icon="checkmark-circle-outline" onPress={()=>router.push({pathname:"/order/[id]",params:{id:alert.roundId}})}/>)}
     </View>:<EmptyPanel locale={locale} icon="checkmark-circle-outline" title={m23(locale,"noAttention")}
       hint={m23(locale,"noNotifications")}/>}
    <View style={[styles.security,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name="shield-checkmark-outline" size={19} color={theme.brand}/>
     <Text style={[styles.securityText,{textAlign:rtl?"right":"left"}]}>{m23(locale,"secureHint")}</Text>
    </View>
   </>:<EmptyPanel locale={locale} icon="cloud-offline-outline"
    title={error==="ACCESS_DENIED"?m23(locale,"noRole"):m23(locale,"disconnected")}
    onAction={()=>void refresh(true)} actionLabel={m23(locale,"retryData")}/>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},
 content:{paddingHorizontal:17,paddingBottom:32,gap:15},
 bell:{width:45,height:45,alignItems:"center",justifyContent:"center",
  backgroundColor:"#fff",borderRadius:14,borderWidth:1,borderColor:theme.border},
 dot:{position:"absolute",top:9,right:9,width:9,height:9,borderRadius:6,
  backgroundColor:theme.danger,borderWidth:1,borderColor:"#fff"},
 hero:{borderRadius:22,backgroundColor:theme.brandDark,padding:22,gap:10,overflow:"hidden"},
 heroCap:{alignItems:"center",justifyContent:"space-between"},
 heroTag:{alignItems:"center",gap:6,paddingHorizontal:12,paddingVertical:7,
  borderRadius:30,backgroundColor:"#FFFFFF19"},
 heroTagText:{fontSize:11,fontWeight:"800",color:"#D7F2E6"},
 heroTitle:{fontSize:23,fontWeight:"900",color:"#fff",lineHeight:32},
 heroDescription:{fontSize:13,fontWeight:"700",color:"#BFE8D9",lineHeight:21},
 heroRestaurant:{alignItems:"center",gap:9,backgroundColor:"#FFFFFF12",padding:12,
  borderRadius:11,marginTop:3},
 heroRestaurantText:{fontSize:13,fontWeight:"800",color:"#fff",flex:1},
 metricGrid:{gap:9},
 metricRow:{flexDirection:"row",gap:10},
 links:{gap:9},alertList:{gap:8},
 security:{alignItems:"center",gap:10,backgroundColor:theme.brandSoft,borderRadius:12,
  borderWidth:1,borderColor:"#D5EADA",padding:13},
 securityText:{flex:1,fontSize:11,lineHeight:18,color:theme.brand,fontWeight:"700"}
});
