import {useCallback,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {floorRequest} from "../../src/floor-api";
import {o5} from "../../src/order-copy";
import {type OrderDetail,nameOf,price} from "../../src/order-types";
export default function OrderDetailScreen(){
 const {id}=useLocalSearchParams<{id:string}>(),{locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [detail,setDetail]=useState<OrderDetail|null>(null),[tab,setTab]=useState<"items"|"activity">("items"),
  [error,setError]=useState(""),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   if(!id)throw new Error(o5(locale,"failed"));
   setDetail(await floorRequest<OrderDetail>("/api/orders/rounds/"+encodeURIComponent(id)));
  }catch(e){setError(e instanceof Error?e.message:o5(locale,"offline"));}
  finally{setLoading(false);}
 },[id,locale]);
 useFocusEffect(useCallback(()=>{void load();const interval=setInterval(()=>{void load();},15000);
  return()=>clearInterval(interval);},[load]));
 const order=detail?.round;
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
  <View style={[styles.head,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable style={styles.icon} accessibilityLabel={o5(locale,"back")} onPress={()=>router.back()}>
    <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={22} color={theme.brand}/></Pressable>
   <Text style={styles.title}>{o5(locale,"details")}</Text>
   <Pressable style={styles.icon} accessibilityLabel={o5(locale,"refresh")} onPress={()=>void load()}>
    <Ionicons name="refresh" size={22} color={theme.brand}/></Pressable></View>
  {loading&&!detail?<ActivityIndicator size="large" color={theme.brand}/>:null}
  {!!error&&<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
   <Pressable onPress={()=>void load()}><Text style={styles.link}>{o5(locale,"retry")}</Text></Pressable></View>}
  {order&&detail&&<>
   <View style={styles.hero}>
     <Text style={styles.muted}>#{order.id.slice(0,8)} · {o5(locale,"round")} {order.roundNumber}</Text>
     <Text style={styles.heroAmount}>{price(order.totalMinor,locale)}</Text>
     <Text style={styles.muted}>{new Date(order.createdAt).toLocaleString(locale)}</Text>
     <View style={styles.badge}><Text style={styles.badgeText}>{o5(locale,detail.ticket?.status??"accepted")}</Text></View>
   </View>
   <View style={styles.tabs}>{(["items","activity"] as const).map(k=>
    <Pressable key={k} style={[styles.tab,k===tab&&styles.tabOn]} onPress={()=>setTab(k)}>
     <Text style={[styles.tabText,k===tab&&styles.tabTextOn]}>{o5(locale,k)}</Text></Pressable>)}</View>
   {tab==="items"?<>
    {detail.lines.map(line=><View style={styles.card} key={line.id}>
      <View style={styles.cardHead}><Text style={styles.name}>{line.itemNameFa&&nameOf(
       {nameFa:line.itemNameFa,nameEn:line.itemNameEn,namePs:line.itemNamePs},locale)}</Text>
       <Text style={styles.price}>{price(line.lineTotalMinor,locale)}</Text></View>
      <Text style={styles.muted}>{line.quantity} × {price(line.unitPriceMinor,locale)}</Text>
      {line.modifierSnapshot.flatMap(g=>g.options.map(opt=>nameOf(opt,locale))).length>0&&
       <Text style={styles.muted}>{line.modifierSnapshot.flatMap(g=>g.options.map(opt=>nameOf(opt,locale))).join(" · ")}</Text>}
      {!!line.note&&<Text style={styles.note}>{o5(locale,"note")}: {line.note}</Text>}
    </View>)}
    {!!order.orderNote&&<View style={styles.card}><Text style={styles.name}>{o5(locale,"orderNote")}</Text>
       <Text style={styles.muted}>{order.orderNote}</Text></View>}
    <View style={styles.card}><View style={styles.cardHead}><Text style={styles.name}>{o5(locale,"subtotal")}</Text>
      <Text style={styles.price}>{price(order.subtotalMinor,locale)}</Text></View>
      <Text style={styles.muted}>{o5(locale,"noConfiguredFees")}</Text>
      <View style={styles.cardHead}><Text style={styles.name}>{o5(locale,"total")}</Text>
        <Text style={styles.price}>{price(order.totalMinor,locale)}</Text></View></View>
   </>:<View style={styles.card}>{detail.activity.map(a=><View key={a.id} style={styles.activity}>
    <Ionicons name="checkmark-circle-outline" size={19} color={theme.brand}/>
    <View><Text style={styles.name}>{a.action.replaceAll("_"," ").replaceAll("."," · ")}</Text>
      <Text style={styles.muted}>{new Date(a.createdAt).toLocaleString(locale)}</Text></View></View>)}</View>}
   <View style={styles.hint}><Text style={styles.muted}>{detail.ticket?.status==="ready"?o5(locale,"readyHint"):
      detail.ticket?.status==="preparing"?o5(locale,"preparingHint"):o5(locale,"newHint")}</Text></View>
   <Pressable onPress={()=>router.push({pathname:"/visit/[id]/new-order",params:{id:order.visitId}})} style={styles.primary}>
    <Ionicons name="add-outline" size={20} color="white"/><Text style={styles.primaryText}>{o5(locale,"addRound")}</Text></Pressable>
   <Pressable style={styles.secondary} onPress={()=>router.push({pathname:"/table/[id]",params:{id:order.tableId}})}>
    <Text style={styles.link}>{o5(locale,"returnToTable")}</Text></Pressable>
  </>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},content:{paddingHorizontal:18,paddingTop:55,paddingBottom:60,gap:14},
 head:{alignItems:"center",justifyContent:"space-between",gap:10},title:{color:theme.ink,fontSize:20,fontWeight:"800"},
 icon:{width:42,height:42,borderRadius:12,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center"},
 hero:{backgroundColor:"#E7F6ED",padding:21,borderRadius:17,gap:9},
 heroAmount:{fontSize:28,color:theme.ink,fontWeight:"900"},muted:{color:theme.muted,fontSize:13,lineHeight:21},
 badge:{backgroundColor:"#CEEADB",borderRadius:16,paddingVertical:6,paddingHorizontal:12,alignSelf:"flex-start"},
 badgeText:{color:theme.brand,fontWeight:"800",fontSize:12},
 tabs:{flexDirection:"row",gap:5,padding:4,backgroundColor:"#E7ECE8",borderRadius:13},
 tab:{flex:1,alignItems:"center",padding:11,borderRadius:10},tabOn:{backgroundColor:"white"},
 tabText:{fontSize:14,color:theme.muted,fontWeight:"800"},tabTextOn:{color:theme.brand},
 card:{padding:17,borderRadius:15,backgroundColor:"white",borderWidth:1,borderColor:theme.border,gap:9},
 cardHead:{flexDirection:"row",justifyContent:"space-between",gap:12},
 name:{fontSize:15,fontWeight:"800",color:theme.ink,flex:1},price:{fontSize:14,color:theme.brand,fontWeight:"800"},
 note:{fontSize:12,color:"#94601B",backgroundColor:"#FFF7EA",padding:9,borderRadius:9},
 activity:{flexDirection:"row",alignItems:"center",gap:11,paddingVertical:10,borderBottomWidth:1,borderBottomColor:theme.border},
 hint:{backgroundColor:"#F0F6F1",padding:14,borderRadius:12},primary:{minHeight:52,backgroundColor:theme.brand,
   borderRadius:13,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9},
 primaryText:{color:"white",fontWeight:"800",fontSize:15},
 secondary:{alignItems:"center",padding:10},link:{color:theme.brand,fontWeight:"800"},
 error:{backgroundColor:"#FFEAEA",padding:13,borderRadius:11,gap:9},errorText:{color:theme.danger}
});
