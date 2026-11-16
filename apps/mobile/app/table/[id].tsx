import {useCallback,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {direction} from "@dineflow/shared";
import {floorRequest,FloorRequestError} from "../../src/floor-api";
import {f,since,type Table} from "../../src/floor";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {o5} from "../../src/order-copy";
import {price} from "../../src/order-types";
import {gm7} from "../../src/guest-copy";
import {type GuestPin,type GuestApprovalPage} from "../../src/guest-types";
export default function TableDetails(){
 const {id}=useLocalSearchParams<{id:string}>(),{locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [table,setTable]=useState<Table|null>(null),[canOpen,setCanOpen]=useState(false);
 const [rounds,setRounds]=useState<{id:string;roundNumber:number;status:string;totalMinor:number;createdAt:string}[]>([]);
 const [estimate,setEstimate]=useState<number|null>(null);
 const [guestPin,setGuestPin]=useState<GuestPin|null>(null),[pendingGuest,setPendingGuest]=useState(0);
 const [party,setParty]=useState("2"),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const load=useCallback(async(quiet=false)=>{
  if(!quiet)setLoading(true);setError("");
  try{
   if(!id||typeof id!=="string")throw new Error("Missing table identifier.");
   const result=await floorRequest<{table:Table;canOpen:boolean}>("/api/floor/tables/"+encodeURIComponent(id));
   setTable(result.table);setCanOpen(result.canOpen);
   if(result.table.visitId){
    try{const pin=await floorRequest<GuestPin>("/api/guest/staff/visits/"+encodeURIComponent(result.table.visitId)+"/pin");setGuestPin(pin);}catch{setGuestPin(null);}
    try{const guest=await floorRequest<GuestApprovalPage>("/api/guest/staff/approvals?status=pending&tableId="+encodeURIComponent(result.table.id));setPendingGuest(guest.total);}catch{setPendingGuest(0);}
    try{
      const orders=await floorRequest<{rounds:{id:string;roundNumber:number;status:string;totalMinor:number;createdAt:string}[];estimateMinor:number}>(
        "/api/orders/visits/"+encodeURIComponent(result.table.visitId)+"/rounds");
      setRounds(orders.rounds);setEstimate(orders.estimateMinor);
    }catch{setRounds([]);setEstimate(null);}
   }else{setRounds([]);setEstimate(null);setGuestPin(null);setPendingGuest(0);}
   if(!quiet)setParty(String(Math.min(2,result.table.seats)));
  }catch(e){
   if(e instanceof FloorRequestError&&e.status===401){router.replace("/sign-in");return;}
   setError(e instanceof Error?e.message:f(locale,"offline"));
  }finally{setLoading(false);}
 },[id,locale]);
 useFocusEffect(useCallback(()=>{
  void load();const timer=setInterval(()=>{void load(true);},15000);
  return ()=>clearInterval(timer);
 },[load]));
 async function open(){
  if(!table||busy)return;
  const count=Number(party);
  if(!Number.isSafeInteger(count)||count<1||count>30){setError("1–30");return;}
  if(count>table.seats){setError(f(locale,"oversize"));return;}
  setBusy(true);setError("");setNotice("");
  try{
   const result=await floorRequest<{created:boolean;visit:{id:string}}>("/api/floor/visits/tables/"+table.id+"/open",
     {method:"POST",body:{partySize:count}});
   setNotice(result.created?f(locale,"visit"):f(locale,"visit"));await load(true);
  }catch(e){setError(e instanceof Error?e.message:f(locale,"offline"));}
  finally{setBusy(false);}
 }
 function makeReady(){
  if(!table||busy)return;
  Alert.alert(f(locale,"cleaning"),f(locale,"confirmClean"),[
   {text:f(locale,"back"),style:"cancel"},
   {text:f(locale,"markReady"),onPress:()=>void ready()}]);
 }
 async function ready(){
  if(!table)return;
  setBusy(true);setError("");
  try{
   await floorRequest("/api/floor/tables/"+table.id+"/ready",{method:"POST",body:{version:table.version}});
   setNotice(f(locale,"available"));await load(true);
  }catch(e){setError(e instanceof Error?e.message:f(locale,"offline"));}
  finally{setBusy(false);}
 }
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
  <View style={[styles.head,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable style={styles.back} accessibilityRole="button" onPress={()=>router.back()}>
    <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={23} color={theme.brand}/></Pressable>
   <Text style={styles.headText}>{f(locale,"details")}</Text>
   <Pressable style={styles.back} accessibilityRole="button" accessibilityLabel={f(locale,"refresh")} onPress={()=>void load()}>
    <Ionicons name="refresh-outline" size={22} color={theme.brand}/></Pressable>
  </View>
  {loading&&!table?<View style={styles.center}><ActivityIndicator size="large" color={theme.brand}/>
    <Text style={styles.muted}>{f(locale,"loading")}</Text></View>:table?<>
    <View style={styles.hero}>
      <Ionicons name="restaurant-outline" size={35} color={theme.brand}/>
      <Text style={[styles.name,{textAlign:rtl?"right":"left"}]}>{table.label}</Text>
      <View style={[styles.status,{backgroundColor:table.status==="occupied"?"#FFF0D9":table.status==="cleaning"?"#EFF0FB":theme.brandSoft}]}>
        <Text style={{fontWeight:"800",color:table.status==="occupied"?"#9B641D":table.status==="cleaning"?"#5A68A9":theme.brand}}>{f(locale,table.status)}</Text></View>
    </View>
    <View style={styles.panel}>
     {([
       [f(locale,"section"),table.sectionName],
       [f(locale,"capacity"),String(table.seats)],
       [f(locale,"waiter"),table.assignedWaiterName??f(locale,"unassigned")],
       [f(locale,"visit"),table.visitId?table.visitId.slice(0,8):f(locale,"noVisit")],
       ...(table.visitId?[[f(locale,"guests"),String(table.visitPartySize??"—")],
         [f(locale,"started"),since(table.visitOpenedAt,locale)]]:[])
     ] as string[][]).map(([key,value])=>
      <View key={key} style={[styles.row,{flexDirection:rtl?"row-reverse":"row"}]}>
       <Text style={styles.muted}>{key}</Text><Text style={styles.value}>{value}</Text></View>)}
    </View>
    {table.status==="available"&&canOpen&&<View style={styles.panel}>
      <Text style={[styles.sectionTitle,{textAlign:rtl?"right":"left"}]}>{f(locale,"open")}</Text>
      <Text style={[styles.muted,{textAlign:rtl?"right":"left"}]}>{f(locale,"party")}</Text>
      <TextInput style={styles.input} value={party} keyboardType="number-pad" maxLength={2}
        onChangeText={setParty} accessibilityLabel={f(locale,"party")}/>
      <Pressable style={[styles.primary,busy&&styles.disabled]} disabled={busy} accessibilityRole="button" onPress={()=>void open()}>
       {busy?<ActivityIndicator color="white"/>:<Ionicons name="people-outline" color="white" size={20}/>}
       <Text style={styles.primaryText}>{f(locale,"confirm")}</Text></Pressable>
    </View>}
    {table.status==="occupied"&&canOpen&&table.visitId&&<View style={styles.pinPanel}>
     <View style={[styles.pinHeader,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Ionicons name="key-outline" color={theme.brand} size={24}/>
      <Text style={styles.sectionTitle}>{gm7(locale,"pinTitle")}</Text></View>
     <Text style={[styles.muted,{textAlign:rtl?"right":"left"}]}>{gm7(locale,"pinDescription")}</Text>
     <Text style={styles.pinDigits} selectable={false}>{guestPin?.pin??"••••••"}</Text>
     <Text style={[styles.muted,{textAlign:rtl?"right":"left"}]}>{gm7(locale,"qrHint")}</Text>
     <Pressable style={styles.rotate} disabled={!guestPin||busy} onPress={()=>{
       Alert.alert(gm7(locale,"pinRotate"),gm7(locale,"pinConfirm"),[
       {text:gm7(locale,"cancel"),style:"cancel"},
       {text:gm7(locale,"finish"),onPress:()=>void(async()=>{
         if(!guestPin)return;setBusy(true);setError("");
         try{
           const next=await floorRequest<GuestPin>("/api/guest/staff/visits/"+table.visitId+"/pin/rotate",
              {method:"POST",body:{version:guestPin.version}});
           setGuestPin({...guestPin,...next});setNotice(gm7(locale,"pinRotated"));
         }catch(e){setError(e instanceof Error?e.message:gm7(locale,"offline"));}
         finally{setBusy(false);}
       })()}]);
     }}>
       <Ionicons name="refresh-circle-outline" size={20} color={theme.brand}/>
       <Text style={styles.rotateText}>{gm7(locale,"pinRotate")}</Text></Pressable>
     <Pressable style={styles.primary} onPress={()=>router.push("/approvals")}>
       <Ionicons name="document-text-outline" color="white" size={19}/>
       <Text style={styles.primaryText}>{gm7(locale,"approvals")}{pendingGuest?" · "+pendingGuest:""}</Text></Pressable>
    </View>}
    {table.status==="occupied"&&canOpen&&table.visitId&&<View style={styles.panel}>
      <Text style={[styles.sectionTitle,{textAlign:rtl?"right":"left"}]}>{o5(locale,"orders")}</Text>
      <Text style={[styles.muted,{textAlign:rtl?"right":"left"}]}>
        {estimate===null?"—":o5(locale,"totalVisit")+": "+price(estimate,locale)}</Text>
      {rounds.length?rounds.map(r=><Pressable key={r.id} style={styles.row}
        onPress={()=>router.push({pathname:"/order/[id]",params:{id:r.id}})}>
        <Text style={styles.value}>{o5(locale,"round")} #{r.roundNumber} · {o5(locale,r.status as "new"|"preparing"|"ready")}</Text>
        <Text style={styles.muted}>{price(r.totalMinor,locale)}</Text></Pressable>):
        <Text style={styles.muted}>{o5(locale,"noOrdersTable")}</Text>}
      <Pressable style={styles.primary} onPress={()=>router.push({pathname:"/visit/[id]/new-order",params:{id:table.visitId!}})}>
        <Ionicons name="add-circle-outline" color="white" size={21}/>
        <Text style={styles.primaryText}>{o5(locale,"addRound")}</Text></Pressable>
    </View>}
    {table.status==="cleaning"&&canOpen&&<Pressable style={[styles.primary,busy&&styles.disabled]}
      disabled={busy} onPress={makeReady}><Ionicons name="checkmark-circle-outline" size={20} color="white"/>
      <Text style={styles.primaryText}>{f(locale,"markReady")}</Text></Pressable>}
    {table.status==="available"&&!canOpen&&<Text style={styles.hint}>{f(locale,"onlyAssigned")}</Text>}
    {table.status==="occupied"&&<Text style={styles.hint}>{f(locale,"pilot")}</Text>}
    {table.status==="disabled"&&<Text style={styles.hint}>{f(locale,"onlyAssigned")}</Text>}
  </>:null}
  {!!notice&&<Text style={styles.notice}>{notice}</Text>}
  {!!error&&<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
    <Pressable onPress={()=>void load()}><Text style={styles.retry}>{f(locale,"retry")}</Text></Pressable></View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 pinPanel:{backgroundColor:"#F3FBF5",borderWidth:1,borderColor:"#A9D7BF",padding:20,gap:14,borderRadius:16},
 pinHeader:{alignItems:"center",gap:10},pinDigits:{fontWeight:"900",fontSize:36,letterSpacing:6,color:"#145C47",textAlign:"center",padding:16,backgroundColor:"white",borderRadius:13,overflow:"hidden"},
 rotate:{flexDirection:"row",gap:9,justifyContent:"center",alignItems:"center",borderRadius:12,borderWidth:1,borderColor:theme.border,padding:13},rotateText:{fontWeight:"800",color:theme.brand,fontSize:13},
 root:{flex:1,backgroundColor:theme.background},
 content:{paddingTop:55,paddingHorizontal:19,paddingBottom:70,gap:17},
 head:{alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:9},
 back:{height:42,width:42,borderRadius:13,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center"},
 headText:{fontSize:20,fontWeight:"800",color:theme.ink},
 center:{padding:55,gap:12,alignItems:"center"},
 hero:{backgroundColor:"#E7F5ED",padding:25,borderRadius:theme.radius,gap:12},
 name:{fontSize:28,fontWeight:"800",color:theme.ink},
 status:{paddingVertical:7,paddingHorizontal:13,borderRadius:20,alignSelf:"flex-start"},
 panel:{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:16,padding:20,gap:15},
 row:{alignItems:"center",justifyContent:"space-between",gap:16,borderBottomWidth:1,borderBottomColor:theme.border,paddingBottom:12},
 muted:{color:theme.muted,fontSize:14},
 value:{color:theme.ink,fontWeight:"800",fontSize:15,flexShrink:1,textAlign:"right"},
 sectionTitle:{fontSize:19,color:theme.ink,fontWeight:"800"},
 input:{borderWidth:1,borderColor:theme.border,borderRadius:12,height:50,textAlign:"center",fontWeight:"800",fontSize:20,color:theme.ink},
 primary:{minHeight:51,backgroundColor:theme.brand,borderRadius:13,paddingHorizontal:19,flexDirection:"row",gap:10,alignItems:"center",justifyContent:"center"},
 primaryText:{color:"white",fontSize:15,fontWeight:"800"},
 disabled:{opacity:.5},
 hint:{color:"#755A2C",backgroundColor:"#FFF6E8",borderWidth:1,borderColor:"#F0DEC1",borderRadius:12,padding:14,lineHeight:22},
 error:{backgroundColor:"#FFECEC",padding:14,borderRadius:12,gap:10},
 errorText:{color:theme.danger},
 retry:{fontWeight:"800",color:theme.brand},
 notice:{color:theme.brand,fontWeight:"800",paddingHorizontal:12}
});
