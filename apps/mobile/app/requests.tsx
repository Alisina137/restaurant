import {useCallback,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {useFocusEffect,router} from "expo-router";
import {Ionicons} from "@expo/vector-icons";
import {direction} from "@dineflow/shared";
import {floorRequest} from "../src/floor-api";
import {useLocale} from "../src/locale";
import {theme} from "../src/theme";
import {sr8,type ServiceList,type ServiceRequest} from "../src/service-copy";
export default function Requests(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [tab,setTab]=useState<"active"|"resolved">("active"),[data,setData]=useState<ServiceList|null>(null),
  [loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),
  [notes,setNotes]=useState<Record<string,string>>({});
 const load=useCallback(async(silent=false)=>{
   if(!silent)setLoading(true);
   try{setData(await floorRequest<ServiceList>("/api/service/requests?status="+tab));
      setError("");}catch(e){setError(e instanceof Error?e.message:sr8(locale,"error"));}
   finally{setLoading(false);}
 },[tab,locale]);
 useFocusEffect(useCallback(()=>{void load();const timer=setInterval(()=>{void load(true);},11000);
   return()=>clearInterval(timer);},[load]));
 async function update(request:ServiceRequest,action:"acknowledge"|"resolve"){
   if(busy)return;setBusy(request.id);setError("");
   try{await floorRequest("/api/service/requests/"+request.id+"/transition",{
     method:"POST",body:{version:request.version,action,note:notes[request.id]??""}});
     await load(true);
   }catch(e){setError(e instanceof Error?e.message:sr8(locale,"error"));await load(true);}
   finally{setBusy("");}
 }
 return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
   <View style={[styles.head,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Pressable style={styles.iconButton} onPress={()=>router.back()} accessibilityRole="button">
       <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={23} color={theme.brand}/></Pressable>
      <View style={{flex:1}}><Text style={styles.eyebrow}>DINEFLOW / SERVICE</Text>
       <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{sr8(locale,"title")}</Text></View>
      <Pressable style={styles.iconButton} onPress={()=>void load()} accessibilityRole="button">
       <Ionicons name="refresh-outline" size={22} color={theme.brand}/></Pressable>
   </View>
   <Text style={styles.subtitle}>{sr8(locale,"subtitle")}</Text>
   <View style={styles.tabs}>{(["active","resolved"] as const).map(k=><Pressable key={k}
     onPress={()=>setTab(k)} style={[styles.tab,tab===k&&styles.tabActive]}>
      <Text style={[styles.tabText,tab===k&&styles.tabTextActive]}>{sr8(locale,k)}</Text></Pressable>)}</View>
   {error&&<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
     <Pressable onPress={()=>void load()}><Text style={styles.retry}>{sr8(locale,"retry")}</Text></Pressable></View>}
   {loading&&!data?<ActivityIndicator size="large" color={theme.brand}/>:
    !data?.items.length?<View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={38} color={theme.brand}/>
      <Text style={styles.subtitle}>{sr8(locale,"empty")}</Text></View>:
    data.items.map(item=><View style={styles.card} key={item.id}>
      <View style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
       <View style={styles.icon}><Ionicons name={item.type==="water"?"water-outline":
         item.type==="bill"?"receipt-outline":item.type==="other"?"chatbubble-outline":"notifications-outline"}
          size={23} color={theme.brand}/></View>
       <View style={{flex:1}}><Text style={[styles.itemTitle,{textAlign:rtl?"right":"left"}]}>
         {sr8(locale,item.type)} · {sr8(locale,"table")} {item.tableLabel}</Text>
         <Text style={[styles.subtitle,{textAlign:rtl?"right":"left"}]}>
           {sr8(locale,item.status==="pending"?"pending":item.status==="acknowledged"?"acknowledged":"resolved")}</Text></View>
      </View>
      {!!item.note&&<Text style={[styles.note,{textAlign:rtl?"right":"left"}]}>{item.note}</Text>}
      <Text style={styles.time}>{new Date(item.createdAt).toLocaleString(locale)}</Text>
      {item.status!=="resolved"&&<>
       <TextInput value={notes[item.id]??""} maxLength={200} placeholder={sr8(locale,"note")}
        placeholderTextColor={theme.muted} onChangeText={text=>setNotes(v=>({...v,[item.id]:text}))}
        style={[styles.input,{textAlign:rtl?"right":"left"}]}/>
       {item.status==="pending"&&<Pressable style={styles.secondary} disabled={!!busy}
          onPress={()=>void update(item,"acknowledge")}>
         <Ionicons name="checkmark-outline" size={19} color={theme.brand}/>
         <Text style={styles.secondaryText}>{sr8(locale,"ack")}</Text></Pressable>}
       <Pressable style={styles.primary} disabled={!!busy} onPress={()=>void update(item,"resolve")}>
        {busy===item.id?<ActivityIndicator color="white"/>:<Ionicons name="checkmark-done-outline" color="white" size={19}/>}
        <Text style={styles.primaryText}>{sr8(locale,"resolve")}</Text></Pressable>
      </>}
      <Pressable onPress={()=>router.push({pathname:"/table/[id]",params:{id:item.tableId}})}
        accessibilityRole="button"><Text style={styles.link}>{sr8(locale,"open")}</Text></Pressable>
    </View>)}
 </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:theme.background},content:{padding:19,paddingTop:57,paddingBottom:85,gap:16},
 head:{alignItems:"center",gap:12},iconButton:{padding:10,backgroundColor:theme.brandSoft,borderRadius:12},
 eyebrow:{fontSize:11,fontWeight:"900",color:theme.brand,letterSpacing:1},
 title:{fontSize:24,color:theme.ink,fontWeight:"900"},subtitle:{fontSize:13,color:theme.muted,lineHeight:19},
 tabs:{flexDirection:"row",gap:6,backgroundColor:"#ECF4EF",padding:5,borderRadius:14},
 tab:{flex:1,padding:12,alignItems:"center",borderRadius:10},tabActive:{backgroundColor:"white"},
 tabText:{fontSize:13,fontWeight:"800",color:theme.muted},tabTextActive:{color:theme.brand},
 card:{padding:18,backgroundColor:"white",borderWidth:1,borderColor:theme.border,borderRadius:17,gap:12},
 row:{alignItems:"center",gap:12},icon:{padding:12,backgroundColor:theme.brandSoft,borderRadius:14},
 itemTitle:{fontSize:15,fontWeight:"900",color:theme.ink},note:{fontSize:13,color:theme.ink,lineHeight:19},
 time:{fontSize:11,color:theme.muted},input:{borderWidth:1,borderColor:theme.border,borderRadius:10,
  minHeight:45,color:theme.ink,backgroundColor:"white",paddingHorizontal:12,fontSize:13},
 primary:{backgroundColor:theme.brand,borderRadius:11,padding:14,flexDirection:"row",justifyContent:"center",alignItems:"center",gap:8},
 primaryText:{fontWeight:"850",color:"white",fontSize:14},
 secondary:{borderWidth:1,borderColor:theme.border,borderRadius:11,padding:13,flexDirection:"row",justifyContent:"center",gap:8},
 secondaryText:{color:theme.brand,fontWeight:"850",fontSize:13},
 link:{fontSize:13,fontWeight:"800",color:theme.brand,textAlign:"center",padding:7},
 empty:{padding:50,gap:16,alignItems:"center"},error:{backgroundColor:"#FFF0EC",padding:15,borderRadius:12},
 errorText:{color:"#9B332B"},retry:{color:theme.brand,marginTop:8,fontWeight:"800"}
});
