import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {floorRequest} from "../../src/floor-api";
import {o5} from "../../src/order-copy";
import {price,type OrderSummary,type Page} from "../../src/order-types";
type Status="active"|"ready"|"completed";
export default function Orders(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const params=useLocalSearchParams<{tab?:string}>();
 const [tab,setTab]=useState<Status>(params.tab==="ready"?"ready":params.tab==="completed"?"completed":"active"),[page,setPage]=useState(1);
 useEffect(()=>{if(params.tab==="ready"||params.tab==="completed"||params.tab==="active"){setTab(params.tab);setPage(1);setData(null);}},[params.tab]);
 const [data,setData]=useState<Page<OrderSummary>|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async(silent=false)=>{
  if(!silent)setLoading(true);
  setError("");
  try{setData(await floorRequest<Page<OrderSummary>>("/api/orders/my?status="+tab+"&page="+page));}
  catch(e){setError(e instanceof Error?e.message:o5(locale,"offline"));}
  finally{setLoading(false);}
 },[tab,page,locale]);
 useFocusEffect(useCallback(()=>{void load();const timer=setInterval(()=>{void load(true);},12000);
   return()=>clearInterval(timer);},[load]));
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()} tintColor={theme.brand}/>}>
  <View style={[styles.head,{flexDirection:rtl?"row-reverse":"row"}]}>
   <View><Text style={styles.eyebrow}>DINEFLOW</Text><Text style={styles.title}>{o5(locale,"orders")}</Text></View>
   <Pressable onPress={()=>void load()} style={styles.refresh} accessibilityLabel={o5(locale,"refresh")}>
    <Ionicons name="refresh-outline" size={22} color={theme.brand}/></Pressable>
  </View>
  <View style={styles.tabs}>{(["active","ready","completed"] as const).map(k=>
    <Pressable key={k} onPress={()=>{setTab(k);setPage(1);setData(null);}} style={[styles.tab,tab===k&&styles.tabActive]}>
     <Text style={[styles.tabText,tab===k&&styles.tabTextActive]}>{o5(locale,k)}</Text></Pressable>)}</View>
  {!!error&&<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
    <Pressable onPress={()=>void load()}><Text style={styles.link}>{o5(locale,"retry")}</Text></Pressable></View>}
  {loading&&!data?<View style={styles.center}><ActivityIndicator size="large" color={theme.brand}/></View>:
    data?.items.length?data.items.map(row=><Pressable key={row.id} onPress={()=>router.push({pathname:"/order/[id]",params:{id:row.id}})}
      accessibilityRole="button" style={styles.card}>
     <View style={[styles.cardHead,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Text style={styles.cardTitle}>{o5(locale,"table")} {row.tableLabel}</Text>
      <Text style={[styles.badge,{backgroundColor:row.status==="ready"?"#E6F6EC":"#FFF1DB",
        color:row.status==="ready"?"#0F766E":"#93601E"}]}>{o5(locale,row.status)}</Text></View>
     <Text style={[styles.meta,{textAlign:rtl?"right":"left"}]}>{o5(locale,"round")} #{row.roundNumber} · {new Date(row.createdAt).toLocaleString(locale)}</Text>
     <View style={[styles.cardFoot,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Text style={styles.money}>{price(row.totalMinor,locale)}</Text>
      <Ionicons name={rtl?"arrow-back":"arrow-forward"} size={19} color={theme.brand}/></View>
   </Pressable>):
   <View style={styles.empty}><Ionicons name="receipt-outline" size={42} color={theme.muted}/>
    <Text style={styles.muted}>{o5(locale,"emptyOrders")}</Text>
    {tab==="completed"&&<Text style={styles.muted}>{o5(locale,"completedHint")}</Text>}</View>}
  {data&&data.total>10&&<View style={styles.pager}>
   <Pressable disabled={page<=1} onPress={()=>setPage(p=>p-1)}><Text style={[styles.link,page<=1&&styles.off]}>{o5(locale,"previous")}</Text></Pressable>
   <Text style={styles.muted}>{page} / {Math.max(1,Math.ceil(data.total/10))}</Text>
   <Pressable disabled={page>=Math.ceil(data.total/10)} onPress={()=>setPage(p=>p+1)}>
    <Text style={[styles.link,page>=Math.ceil(data.total/10)&&styles.off]}>{o5(locale,"next")}</Text></Pressable>
  </View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},content:{paddingTop:61,paddingHorizontal:17,paddingBottom:100,gap:15},
 head:{alignItems:"center",justifyContent:"space-between"},eyebrow:{fontSize:11,color:theme.brand,letterSpacing:1.4,fontWeight:"900"},
 title:{fontSize:27,color:theme.ink,fontWeight:"800"},refresh:{padding:13,backgroundColor:theme.brandSoft,borderRadius:13},
 tabs:{flexDirection:"row",backgroundColor:"#E8EEE9",borderRadius:14,padding:4,gap:4},
 tab:{flex:1,paddingVertical:12,alignItems:"center",borderRadius:11},tabActive:{backgroundColor:"white"},
 tabText:{fontSize:13,color:theme.muted,fontWeight:"800"},tabTextActive:{color:theme.brand},
 card:{backgroundColor:"white",borderRadius:17,borderWidth:1,borderColor:theme.border,padding:18,gap:13},
 cardHead:{alignItems:"center",justifyContent:"space-between",gap:12},cardTitle:{fontSize:19,fontWeight:"800",color:theme.ink},
 badge:{borderRadius:10,paddingVertical:6,paddingHorizontal:10,fontWeight:"800",fontSize:12},
 meta:{fontSize:12,color:theme.muted},cardFoot:{alignItems:"center",justifyContent:"space-between",borderTopWidth:1,borderTopColor:theme.border,paddingTop:10},
 money:{fontWeight:"800",color:theme.brand,fontSize:15},empty:{paddingVertical:85,alignItems:"center",gap:15,paddingHorizontal:25},
 muted:{fontSize:14,color:theme.muted,textAlign:"center",lineHeight:22},center:{padding:80},
 error:{padding:15,backgroundColor:"#FFF1F1",borderRadius:14,gap:10},errorText:{color:theme.danger},
 link:{fontSize:14,color:theme.brand,fontWeight:"800"},off:{opacity:.35},
 pager:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:18}
});
