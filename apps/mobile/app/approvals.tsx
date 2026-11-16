import {useCallback,useState} from "react";
import {ActivityIndicator,AppState,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../src/locale";
import {theme} from "../src/theme";
import {floorRequest} from "../src/floor-api";
import {gm7} from "../src/guest-copy";
import {type GuestApprovalPage,guestName} from "../src/guest-types";
import {price} from "../src/order-types";
export default function Approvals(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [data,setData]=useState<GuestApprovalPage|null>(null),[page,setPage]=useState(1),
   [busy,setBusy]=useState(true),[error,setError]=useState("");
 const load=useCallback(async(quiet=false)=>{
  if(!quiet)setBusy(true);setError("");
  try{setData(await floorRequest<GuestApprovalPage>("/api/guest/staff/approvals?status=pending&page="+page));}
  catch(e){setError(e instanceof Error?e.message:gm7(locale,"offline"));}
  finally{setBusy(false);}
 },[locale,page]);
 useFocusEffect(useCallback(()=>{
   void load();const timer=setInterval(()=>{if(AppState.currentState==="active")void load(true);},10000);
   const listener=AppState.addEventListener("change",x=>{if(x==="active")void load(true);});
   return()=>{clearInterval(timer);listener.remove();};
 },[load]));
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}
   refreshControl={<RefreshControl refreshing={busy} onRefresh={()=>void load()} tintColor={theme.brand}/>}>
   <View style={[styles.header,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Pressable onPress={()=>router.back()} style={styles.icon} accessibilityLabel={gm7(locale,"back")}>
       <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={23} color={theme.brand}/></Pressable>
     <View style={styles.heading}><Text style={styles.eyebrow}>DINEFLOW · {gm7(locale,"guest")}</Text>
       <Text style={styles.title}>{gm7(locale,"approvals")}</Text></View>
     <Pressable onPress={()=>void load()} style={styles.icon} accessibilityLabel={gm7(locale,"refresh")}>
       <Ionicons name="refresh-outline" size={22} color={theme.brand}/></Pressable>
   </View>
   <View style={styles.metrics}><Ionicons name="receipt-outline" size={23} color={theme.brand}/>
     <View><Text style={styles.metricsTitle}>{gm7(locale,"pendingCount")}</Text>
       <Text style={styles.metric}>{data?.total??"—"}</Text></View></View>
   {!!error&&<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
     <Pressable onPress={()=>void load()}><Text style={styles.link}>{gm7(locale,"retry")}</Text></Pressable></View>}
   {busy&&!data?<ActivityIndicator size="large" color={theme.brand}/>:
    data?.items.length?data.items.map(item=><Pressable key={item.id} style={styles.card}
     accessibilityRole="button"
     onPress={()=>router.push({pathname:"/approvals/[id]",params:{id:item.id}})}>
      <View style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
       <Text style={styles.tableName}>{gm7(locale,"table")} {item.tableLabel}</Text>
       <Text style={styles.badge}>{gm7(locale,"pending")}</Text></View>
      <Text style={[styles.meta,{textAlign:rtl?"right":"left"}]}>{item.preview.slice(0,3)
        .map(x=>x.quantity+" × "+guestName(x,locale)).join(" · ")}</Text>
      <View style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
       <Text style={styles.amount}>{price(item.estimatedMinor,locale)}</Text>
       <Ionicons name={rtl?"chevron-back":"chevron-forward"} color={theme.brand} size={20}/></View>
      <Text style={[styles.meta,{textAlign:rtl?"right":"left"}]}>{new Date(item.createdAt).toLocaleString(locale)}</Text>
    </Pressable>):
    <View style={styles.empty}><Ionicons name="shield-checkmark-outline" size={43} color={theme.brand}/>
      <Text style={styles.meta}>{gm7(locale,"noPending")}</Text></View>}
   {data&&data.total>10&&<View style={styles.pager}>
     <Pressable disabled={page<=1} onPress={()=>setPage(x=>x-1)}><Text style={styles.link}>‹</Text></Pressable>
     <Text style={styles.meta}>{page} / {Math.ceil(data.total/10)}</Text>
     <Pressable disabled={page>=Math.ceil(data.total/10)} onPress={()=>setPage(x=>x+1)}><Text style={styles.link}>›</Text></Pressable>
   </View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},content:{padding:18,paddingTop:57,paddingBottom:70,gap:14},
 header:{alignItems:"center",gap:13},heading:{flex:1},
 icon:{width:43,height:43,backgroundColor:theme.brandSoft,borderRadius:12,alignItems:"center",justifyContent:"center"},
 eyebrow:{color:theme.brand,fontWeight:"900",fontSize:10,letterSpacing:1.2},
 title:{fontSize:22,color:theme.ink,fontWeight:"800"},metrics:{flexDirection:"row",gap:12,alignItems:"center",backgroundColor:"#E5F5EB",borderRadius:15,padding:18},
 metricsTitle:{fontSize:12,color:theme.brand,fontWeight:"800"},metric:{fontSize:25,color:theme.ink,fontWeight:"900"},
 card:{backgroundColor:"white",borderWidth:1,borderColor:theme.border,borderTopColor:"#DDAD5F",borderTopWidth:3,borderRadius:16,
  padding:18,gap:13},
 row:{alignItems:"center",justifyContent:"space-between",gap:14},
 tableName:{color:theme.ink,fontWeight:"900",fontSize:20},
 badge:{backgroundColor:"#FFF1DA",color:"#97661E",fontSize:11,fontWeight:"800",borderRadius:11,paddingHorizontal:9,paddingVertical:7},
 amount:{fontSize:16,fontWeight:"900",color:theme.brand},
 meta:{fontSize:12,color:theme.muted,lineHeight:21},
 empty:{paddingVertical:85,alignItems:"center",gap:15},pager:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:18},
 error:{padding:15,backgroundColor:"#FFF0F0",borderRadius:12,gap:9},errorText:{color:theme.danger},link:{color:theme.brand,fontWeight:"800",fontSize:16}
});