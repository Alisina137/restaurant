import {useCallback,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {direction,s8} from "@dineflow/shared";
import {floorRequest} from "../../src/floor-api";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {nameOf,price,type OrderDetail} from "../../src/order-types";
const fresh=()=>"change-"+Date.now()+"-"+Math.random().toString(36).slice(2,14);
export default function ChangeRequest(){
 const {id,roundId}=useLocalSearchParams<{id:string;roundId:string}>(),{locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [detail,setDetail]=useState<OrderDetail|null>(null),[reason,setReason]=useState(""),
  [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),
  [error,setError]=useState(""),[success,setSuccess]=useState(false);
 const key=useRef(fresh());
 const load=useCallback(async()=>{
  if(!roundId)return;
  setLoading(true);
  try{setDetail(await floorRequest<OrderDetail>("/api/orders/rounds/"+encodeURIComponent(roundId)));}
  catch(e){setError(e instanceof Error?e.message:s8(locale,"error"));}
  finally{setLoading(false);}
 },[roundId,locale]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 const line=detail?.lines.find(x=>x.id===id);
 async function submit(){
   if(busy||!line||reason.trim().length<8)return;
   setBusy(true);setError("");
   try{
     await floorRequest("/api/service/changes",{method:"POST",body:{
       lineId:line.id,reason:reason.trim(),idempotencyKey:key.current}});
     setSuccess(true);
   }catch(e){setError(e instanceof Error?e.message:s8(locale,"error"));}
   finally{setBusy(false);}
 }
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <View style={[styles.head,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Pressable style={styles.back} onPress={()=>router.back()} accessibilityLabel={s8(locale,"back")}>
       <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={22} color={theme.brand}/></Pressable>
     <Text style={styles.headTitle}>{s8(locale,"requestChange")}</Text></View>
    {loading&&!detail?<ActivityIndicator size="large" color={theme.brand}/>:
    line?<View style={styles.card}>
      <View style={styles.icon}><Ionicons name="restaurant-outline" color={theme.brand} size={24}/></View>
      <Text style={styles.label}>{s8(locale,"item")}</Text>
      <Text style={styles.itemName}>{nameOf({nameFa:line.itemNameFa,
        namePs:line.itemNamePs,nameEn:line.itemNameEn},locale)}</Text>
      <Text style={styles.muted}>{line.quantity} × {price(line.unitPriceMinor,locale)}
        {" · "}{line.kitchenStatus}</Text>
      <Text style={styles.explain}>{s8(locale,"changeHelp")}</Text>
      {["new","preparing"].includes(line.kitchenStatus)&&!success?<>
        <Text style={styles.label}>{s8(locale,"changeReason")}</Text>
        <TextInput multiline maxLength={250} value={reason} onChangeText={text=>{
          if(text!==reason){key.current=fresh();setReason(text);}} placeholder={s8(locale,"changeReason")}
          style={[styles.input,{textAlign:rtl?"right":"left"}]}/>
        <Text style={styles.muted}>{reason.trim().length}/250</Text>
        <Pressable disabled={busy||reason.trim().length<8} onPress={()=>void submit()}
         style={[styles.primary,(busy||reason.trim().length<8)&&styles.disabled]}>
          {busy?<ActivityIndicator color="white"/>:<Ionicons name="shield-checkmark-outline" size={20} color="white"/>}
          <Text style={styles.primaryText}>{s8(locale,"submitChange")}</Text></Pressable>
       </>:success?<View style={styles.ok}><Ionicons name="checkmark-circle-outline" size={22} color={theme.brand}/>
        <Text style={styles.okText}>{s8(locale,"managerReview")}</Text>
        <Pressable onPress={()=>router.replace("/requests")}><Text style={styles.link}>{s8(locale,"viewRequests")}</Text></Pressable>
       </View>:<Text style={styles.warn}>{s8(locale,"readyBlocked")}</Text>}
    </View>:<Text style={styles.muted}>{s8(locale,"error")}</Text>}
    {!!error&&<View style={styles.error}><Text style={styles.warn}>{error}</Text>
      <Pressable onPress={()=>void load()}><Text style={styles.link}>{s8(locale,"retry")}</Text></Pressable></View>}
    <Text style={styles.muted}>{s8(locale,"immutable")}</Text>
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},content:{paddingHorizontal:18,paddingTop:57,paddingBottom:65,gap:17},
 head:{alignItems:"center",gap:12},back:{width:43,height:43,borderRadius:12,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center"},
 headTitle:{flex:1,fontSize:20,fontWeight:"900",color:theme.ink},
 card:{padding:19,backgroundColor:"white",borderWidth:1,borderColor:theme.border,borderRadius:17,gap:13},
 icon:{width:52,height:52,borderRadius:14,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center"},
 label:{fontWeight:"800",fontSize:13,color:theme.muted},
 itemName:{fontWeight:"900",fontSize:21,color:theme.ink},muted:{fontSize:12,color:theme.muted,lineHeight:20},
 explain:{fontSize:13,lineHeight:23,color:"#4B7360",backgroundColor:"#EDF8F0",padding:13,borderRadius:11},
 input:{minHeight:108,borderRadius:12,padding:13,textAlignVertical:"top",color:theme.ink,borderWidth:1,borderColor:theme.border},
 primary:{borderRadius:12,minHeight:52,backgroundColor:theme.brand,flexDirection:"row",justifyContent:"center",alignItems:"center",gap:9},
 primaryText:{color:"white",fontWeight:"900",fontSize:14},disabled:{opacity:.45},warn:{fontSize:13,color:theme.danger},
 error:{backgroundColor:"#FFF0EF",padding:14,borderRadius:12,gap:8},link:{fontSize:13,color:theme.brand,fontWeight:"800"},
 ok:{backgroundColor:"#E6F6ED",padding:15,borderRadius:12,gap:8,alignItems:"center"},
 okText:{color:theme.brand,fontSize:14,fontWeight:"800"}
});
