import {useCallback,useState} from "react";
import {ActivityIndicator,Alert,AppState,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {direction,s8,type ServicePage,type ServiceRequest,type ChangePage,type OrderChange} from "@dineflow/shared";
import {floorRequest} from "../src/floor-api";
import {useLocale} from "../src/locale";
import {theme} from "../src/theme";
import {price} from "../src/order-types";
type Tab="requests"|"changes";
export default function WaiterRequests(){
 const {tableId}=useLocalSearchParams<{tableId?:string}>(),{locale}=useLocale(),
  rtl=direction(locale)==="rtl";
 const [tab,setTab]=useState<Tab>("requests"),[status,setStatus]=useState<"active"|"all">("active"),
  [page,setPage]=useState(1),[data,setData]=useState<ServicePage|null>(null),
  [changes,setChanges]=useState<ChangePage|null>(null),
  [busy,setBusy]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async(quiet=false)=>{
   if(!quiet)setLoading(true);
   try{
     const [r,c]=await Promise.all([
       floorRequest<ServicePage>("/api/service/requests?status="+status+"&page="+page+
         (tableId?"&tableId="+encodeURIComponent(tableId):"")),
       floorRequest<ChangePage>("/api/service/changes?status="+(status==="active"?"pending":"all")+
         "&page="+page)]);
     setData(r);setChanges(c);setError("");
   }catch(e){if(!quiet)setError(e instanceof Error?e.message:s8(locale,"error"));}
   finally{setLoading(false);}
 },[locale,page,status,tableId]);
 useFocusEffect(useCallback(()=>{
  void load();
  const tick=setInterval(()=>{if(AppState.currentState==="active")void load(true);},9000);
  const state=AppState.addEventListener("change",x=>{if(x==="active")void load(true);});
  return()=>{clearInterval(tick);state.remove();};
 },[load]));
 async function update(row:ServiceRequest,action:"ack"|"resolve"){
   if(busy)return;
   const request=async()=>{
    setBusy(row.id);setError("");
    try{await floorRequest("/api/service/requests/"+row.id+"/"+action,{
      method:"POST",body:{version:row.version,resolutionNote:""}});
      await load(true);
    }catch(e){setError(e instanceof Error?e.message:s8(locale,"error"));await load(true);}
    finally{setBusy("");}
   };
   if(action==="resolve")Alert.alert(s8(locale,"resolve"),s8(locale,"confirmAction"),[
     {text:s8(locale,"cancel"),style:"cancel"},{text:s8(locale,"resolve"),onPress:()=>void request()}]);
   else void request();
 }
 const visible=tab==="requests"?data?.items??[]:changes?.items??[];
 const total=tab==="requests"?data?.total??0:changes?.total??0;
 const max=Math.max(1,Math.ceil(total/10));
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void load()} tintColor={theme.brand}/>}>
    <View style={[styles.head,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Pressable style={styles.icon} onPress={()=>router.back()} accessibilityLabel={s8(locale,"back")}>
       <Ionicons name={rtl?"arrow-forward":"arrow-back"} color={theme.brand} size={21}/></Pressable>
      <View style={{flex:1}}><Text style={styles.eyebrow}>DINEFLOW / {s8(locale,"service")}</Text>
        <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{s8(locale,"needsAttention")}</Text></View>
      <Pressable style={styles.icon} onPress={()=>void load()} accessibilityLabel={s8(locale,"refresh")}>
        <Ionicons name="refresh" color={theme.brand} size={22}/></Pressable></View>
    <View style={styles.summary}><Ionicons name="notifications-outline" size={26} color={theme.brand}/>
      <View><Text style={styles.summaryLabel}>{s8(locale,"openRequests")}</Text>
        <Text style={styles.metric}>{data?.total??"—"}</Text></View></View>
    <View style={styles.tabs}>
      {(["requests","changes"] as const).map(x=><Pressable key={x}
        style={[styles.tab,x===tab&&styles.tabOn]} onPress={()=>{setTab(x);setPage(1);}}>
        <Text style={[styles.tabText,x===tab&&styles.tabTextOn]}>{s8(locale,x==="requests"?"requests":"corrections")}</Text>
       </Pressable>)}</View>
    <View style={styles.tabs}>
     {(["active","all"] as const).map(x=><Pressable key={x} style={[styles.tab,x===status&&styles.tabOn]}
       onPress={()=>{setStatus(x);setPage(1);}}>
       <Text style={[styles.tabText,x===status&&styles.tabTextOn]}>{s8(locale,x)}</Text></Pressable>)}
    </View>
    {error&&<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
       <Pressable onPress={()=>void load()}><Text style={styles.link}>{s8(locale,"retry")}</Text></Pressable></View>}
    {loading&&!data?<ActivityIndicator size="large" color={theme.brand}/>:
      visible.length?tab==="requests"?(data?.items??[]).map(row=><View key={row.id} style={styles.card}>
       <View style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
        <Text style={styles.cardTitle}>{s8(locale,"table")} {row.tableLabel}</Text>
        <View style={[styles.badge,row.status==="resolved"&&styles.badgeDone]}>
          <Text style={styles.badgeText}>{s8(locale,row.status)}</Text></View></View>
       <Text style={[styles.mainText,{textAlign:rtl?"right":"left"}]}>
         {s8(locale,row.reason)}{row.splitPreference?" · "+s8(locale,row.splitPreference):""}</Text>
       {!!row.note&&<Text style={styles.muted}>{row.note}</Text>}
       <Text style={styles.muted}>{new Date(row.createdAt).toLocaleString(locale)}</Text>
       {row.status!=="resolved"&&<View style={styles.actions}>
         {row.status==="pending"&&<Pressable disabled={!!busy} style={styles.secondary}
            onPress={()=>void update(row,"ack")}>
            <Ionicons name="hand-left-outline" color={theme.brand} size={18}/>
            <Text style={styles.link}>{s8(locale,"ack")}</Text></Pressable>}
         <Pressable disabled={!!busy} style={styles.primary} onPress={()=>void update(row,"resolve")}>
            {busy===row.id?<ActivityIndicator color="white"/>:<Ionicons name="checkmark-done-outline" color="white" size={18}/>}
            <Text style={styles.primaryText}>{s8(locale,"resolve")}</Text></Pressable>
       </View>}
      </View>):(changes?.items??[]).map(row=><View key={row.id} style={styles.card}>
        <View style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
          <Text style={styles.cardTitle}>{s8(locale,"round")} #{row.roundId.slice(0,8)}</Text>
          <View style={[styles.badge,row.status==="approved"&&styles.badgeDone]}>
            <Text style={styles.badgeText}>{s8(locale,row.status)}</Text></View></View>
        <Text style={styles.mainText}>{locale==="en"?row.itemNameEn:locale==="ps-AF"?row.itemNamePs:row.itemNameFa}</Text>
        <Text style={styles.muted}>{s8(locale,"reason")}: {row.reason}</Text>
        <Text style={styles.muted}>{row.quantity} × {price(row.originalMinor,locale)}</Text>
        <Text style={styles.muted}>{new Date(row.createdAt).toLocaleString(locale)}</Text>
        {row.status==="pending"&&<Text style={styles.notice}>{s8(locale,"managerReview")}</Text>}
        {row.status==="rejected"&&<Text style={styles.muted}>{row.decisionReason}</Text>}
        </View>):
      <View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={40} color={theme.brand}/>
       <Text style={styles.muted}>{s8(locale,tab==="requests"?"noRequests":"noChanges")}</Text></View>}
    {max>1&&<View style={styles.pager}>
     <Pressable disabled={page<=1} onPress={()=>setPage(x=>x-1)}><Text style={styles.link}>‹</Text></Pressable>
     <Text style={styles.muted}>{page} / {max}</Text>
     <Pressable disabled={page>=max} onPress={()=>setPage(x=>x+1)}><Text style={styles.link}>›</Text></Pressable></View>}
  </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},content:{padding:18,paddingTop:56,paddingBottom:75,gap:14},
 head:{alignItems:"center",gap:12},eyebrow:{color:theme.brand,fontSize:10,fontWeight:"900",letterSpacing:1.2},
 title:{fontSize:23,fontWeight:"900",color:theme.ink},
 icon:{width:42,height:42,backgroundColor:theme.brandSoft,borderRadius:12,alignItems:"center",justifyContent:"center"},
 summary:{backgroundColor:"#E2F5EA",borderRadius:17,padding:18,flexDirection:"row",alignItems:"center",gap:15},
 summaryLabel:{color:theme.brand,fontWeight:"800",fontSize:13},metric:{fontSize:28,fontWeight:"900",color:theme.ink},
 tabs:{flexDirection:"row",backgroundColor:"#E9F0EB",padding:5,borderRadius:13,gap:5},
 tab:{flex:1,alignItems:"center",justifyContent:"center",minHeight:45,padding:9,borderRadius:9},
 tabOn:{backgroundColor:"white"},tabText:{fontSize:13,fontWeight:"800",color:theme.muted},
 tabTextOn:{color:theme.brand},
 card:{backgroundColor:"white",borderWidth:1,borderColor:theme.border,borderRadius:17,padding:17,gap:12},
 row:{alignItems:"center",justifyContent:"space-between",gap:12},
 cardTitle:{fontSize:19,fontWeight:"900",color:theme.ink},
 badge:{padding:8,borderRadius:14,backgroundColor:"#FFF0D9"},
 badgeDone:{backgroundColor:"#DCF4E7"},badgeText:{color:theme.brand,fontSize:11,fontWeight:"800"},
 mainText:{fontSize:15,fontWeight:"800",color:theme.ink},
 muted:{fontSize:12,color:theme.muted,lineHeight:20},actions:{flexDirection:"row",gap:10},
 secondary:{flex:1,minHeight:49,borderRadius:12,backgroundColor:theme.brandSoft,flexDirection:"row",
  alignItems:"center",justifyContent:"center",gap:7},
 link:{color:theme.brand,fontWeight:"800",fontSize:13},
 primary:{flex:1,minHeight:49,borderRadius:12,backgroundColor:theme.brand,flexDirection:"row",
  alignItems:"center",justifyContent:"center",gap:7},
 primaryText:{color:"white",fontSize:13,fontWeight:"800"},
 notice:{backgroundColor:"#FFF4DF",padding:11,borderRadius:9,color:"#906923",fontSize:12},
 empty:{paddingVertical:65,gap:13,alignItems:"center"},pager:{flexDirection:"row",
  alignItems:"center",justifyContent:"space-between",padding:15},
 error:{backgroundColor:"#FFF0EF",borderRadius:12,padding:14,gap:8},
 errorText:{fontSize:12,color:theme.danger}
});
