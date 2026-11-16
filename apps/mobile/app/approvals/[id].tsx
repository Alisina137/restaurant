import {useCallback,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {floorRequest,FloorRequestError} from "../../src/floor-api";
import {gm7} from "../../src/guest-copy";
import {type PendingGuest,guestName} from "../../src/guest-types";
import {price} from "../../src/order-types";
export default function GuestApprovalDetail(){
 const {id}=useLocalSearchParams<{id:string}>(),{locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [data,setData]=useState<PendingGuest|null>(null),[reason,setReason]=useState(""),
   [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{if(!id)throw new Error(gm7(locale,"error"));
    setData(await floorRequest<PendingGuest>("/api/guest/staff/approvals/"+encodeURIComponent(id)));}
  catch(e){setError(e instanceof Error?e.message:gm7(locale,"offline"));}
  finally{setLoading(false);}
 },[id,locale]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 function confirm(decision:"approve"|"reject"){
   if(!data||busy)return;
   if(decision==="reject"&&(reason.trim().length<5||reason.length>200)){
     setError(gm7(locale,"reasonHelp"));return;
   }
   Alert.alert(gm7(locale,decision==="approve"?"approve":"reject"),
      gm7(locale,decision==="approve"?"confirmApprove":"confirmReject"),
      [{text:gm7(locale,"cancel"),style:"cancel"},
       {text:gm7(locale,"finish"),onPress:()=>{void submit(decision);}}]);
 }
 async function submit(decision:"approve"|"reject"){
   if(!data||busy)return;setBusy(true);setError("");
   try{
    await floorRequest("/api/guest/staff/approvals/"+data.id+"/decision",{
      method:"POST",body:{version:data.version,decision,...(decision==="reject"?{reason:reason.trim()}:{})}});
    router.back();
   }catch(e){
     const message=e instanceof FloorRequestError&&e.code==="VERSION_CONFLICT"?gm7(locale,"stale"):
       e instanceof FloorRequestError&&e.code==="PRICE_CHANGED"?gm7(locale,"menuChanged"):
       e instanceof Error?e.message:gm7(locale,"offline");
     await load();setError(message);
   }finally{setBusy(false);}
 }
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
   <View style={[styles.header,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Pressable style={styles.icon} onPress={()=>router.back()} accessibilityLabel={gm7(locale,"back")}>
       <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={22} color={theme.brand}/></Pressable>
     <Text style={styles.title}>{gm7(locale,"review")}</Text>
     <Pressable style={styles.icon} onPress={()=>void load()} accessibilityLabel={gm7(locale,"refresh")}>
       <Ionicons name="refresh-outline" size={21} color={theme.brand}/></Pressable></View>
   {loading&&!data?<ActivityIndicator size="large" color={theme.brand}/>:null}
   {!!error&&<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
     <Pressable onPress={()=>void load()}><Text style={styles.link}>{gm7(locale,"retry")}</Text></Pressable></View>}
   {data&&<>
    <View style={styles.hero}>
     <Text style={styles.eyebrow}>{gm7(locale,"orderFromGuest")}</Text>
     <Text style={styles.heroTitle}>{gm7(locale,"table")} {data.tableLabel}</Text>
     <Text style={styles.badge}>{gm7(locale,data.status)}</Text>
     <Text style={styles.meta}>{new Date(data.createdAt).toLocaleString(locale)}</Text>
    </View>
    <View style={styles.panel}><Text style={styles.panelTitle}>{gm7(locale,"items")}</Text>
     {data.preview.map((line,i)=><View key={i} style={styles.line}>
       <View style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
        <Text style={styles.itemName}>{line.quantity} × {guestName(line,locale)}</Text>
        <Text style={styles.amount}>{price(line.lineTotalMinor,locale)}</Text></View>
       {!!line.modifierSummary.length&&<Text style={styles.meta}>{line.modifierSummary.join(" · ")}</Text>}
       {!!line.note&&<Text style={styles.kitchenNote}>{line.note}</Text>}
     </View>)}
     {!!data.orderNote&&<Text style={styles.kitchenNote}>{gm7(locale,"note")}: {data.orderNote}</Text>}
     <View style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
       <Text style={styles.panelTitle}>{gm7(locale,"amount")}</Text>
       <Text style={styles.total}>{price(data.estimatedMinor,locale)}</Text></View>
    </View>
    {data.status==="pending"&&<>
     <View style={styles.panel}><Text style={styles.panelTitle}>{gm7(locale,"rejectReason")}</Text>
      <Text style={styles.meta}>{gm7(locale,"reasonHelp")}</Text>
      <TextInput multiline maxLength={200} style={[styles.input,{textAlign:rtl?"right":"left"}]}
       placeholder={gm7(locale,"reasonPlaceholder")} placeholderTextColor={theme.muted}
       value={reason} onChangeText={setReason}/></View>
     <View style={styles.actions}>
      <Pressable disabled={busy} onPress={()=>confirm("approve")} style={styles.primary}>
       {busy?<ActivityIndicator color="white"/>:<Ionicons name="checkmark-circle-outline" size={21} color="white"/>}
       <Text style={styles.primaryText}>{gm7(locale,"approve")}</Text></Pressable>
      <Pressable disabled={busy||reason.trim().length<5} onPress={()=>confirm("reject")} style={styles.reject}>
       <Ionicons name="close-circle-outline" size={21} color={theme.danger}/>
       <Text style={styles.rejectText}>{gm7(locale,"reject")}</Text></Pressable>
     </View>
    </>}
   </>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},content:{padding:18,paddingTop:56,paddingBottom:60,gap:17},
 header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:11},
 icon:{width:43,height:43,borderRadius:13,backgroundColor:theme.brandSoft,justifyContent:"center",alignItems:"center"},
 title:{fontSize:21,fontWeight:"900",color:theme.ink},
 hero:{padding:24,borderRadius:16,backgroundColor:"#E8F6EE",gap:11},
 eyebrow:{fontSize:11,fontWeight:"800",color:theme.brand},
 heroTitle:{fontSize:26,fontWeight:"900",color:theme.ink},
 badge:{padding:8,alignSelf:"flex-start",backgroundColor:"#FFF1D8",borderRadius:8,color:"#935E21",fontSize:12,fontWeight:"900"},
 panel:{borderRadius:16,padding:18,backgroundColor:"white",borderWidth:1,borderColor:theme.border,gap:13},
 panelTitle:{fontSize:17,fontWeight:"900",color:theme.ink},
 line:{paddingVertical:13,borderBottomColor:theme.border,borderBottomWidth:1,gap:8},
 row:{justifyContent:"space-between",alignItems:"center",gap:14},
 itemName:{fontSize:14,color:theme.ink,fontWeight:"800",flex:1},
 amount:{fontSize:13,color:theme.brand,fontWeight:"800"},
 total:{fontSize:19,color:theme.brand,fontWeight:"900"},
 meta:{fontSize:12,color:theme.muted,lineHeight:21},
 kitchenNote:{padding:9,backgroundColor:"#FFF7E8",borderRadius:8,color:"#7E6029",fontSize:12},
 input:{borderWidth:1,borderColor:theme.border,borderRadius:13,padding:13,minHeight:92,color:theme.ink,textAlignVertical:"top"},
 actions:{gap:12},primary:{backgroundColor:theme.brand,minHeight:52,borderRadius:13,flexDirection:"row",gap:10,alignItems:"center",justifyContent:"center"},
 primaryText:{color:"white",fontSize:14,fontWeight:"800"},
 reject:{borderWidth:1,borderColor:"#ECC6C4",minHeight:52,borderRadius:13,flexDirection:"row",gap:10,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF3F2"},
 rejectText:{fontWeight:"800",color:theme.danger},error:{padding:14,borderRadius:12,backgroundColor:"#FFEEEE",gap:8},
 errorText:{color:theme.danger},link:{fontWeight:"900",color:theme.brand}
});