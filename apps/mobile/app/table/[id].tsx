import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {direction} from "@dineflow/shared";
import {floorRequest,FloorRequestError} from "../../src/floor-api";
import {f,since,type Table} from "../../src/floor";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {o5} from "../../src/order-copy";
import {price} from "../../src/order-types";
import {sr8,type ServiceList,type ServiceRequest} from "../../src/service-copy";
import {type GuestPin,type GuestApprovalPage} from "../../src/guest-types";
import {m24} from "../../src/mobile24-copy";
import {seatingValidation,tableOperations,serviceActionAllowed,readyToDeliver,visitOrderCount} from "../../src/mobile24-ops";
import {LiveNotice,LoadingPanel,EmptyPanel,SectionHeading,QuickLink} from "../../src/mobile23-ui";
import {useLiveScreen} from "../../src/use-live-screen";
type Round={id:string;roundNumber:number;status:string;totalMinor:number;createdAt:string};
type Rounds={rounds:Round[];estimateMinor:number;currency:string;unsettled:boolean};
type Details={table:Table;canOpen:boolean;orders:Rounds|null;requests:ServiceList|null;
 approvals:GuestApprovalPage|null;pin:GuestPin|null};
type Action="seat"|"clean"|"pin"|"request"|null;
async function getDetails(id:string):Promise<Details>{
 const {table,canOpen}=await floorRequest<{table:Table;canOpen:boolean}>(
  "/api/floor/tables/"+encodeURIComponent(id));
 // PIN, guest orders and service actions are strictly for assigned active visits.
 if(!canOpen||table.status!=="occupied"||!table.visitId)
  return {table,canOpen,orders:null,requests:null,approvals:null,pin:null};
 const visit=encodeURIComponent(table.visitId),tableId=encodeURIComponent(table.id);
 const [orders,requests,approvals,pin]=await Promise.allSettled([
  floorRequest<Rounds>("/api/orders/visits/"+visit+"/rounds"),
  floorRequest<ServiceList>("/api/service/requests?status=active&tableId="+tableId+"&page=1"),
  floorRequest<GuestApprovalPage>("/api/guest/staff/approvals?status=pending&tableId="+tableId+"&page=1"),
  floorRequest<GuestPin>("/api/guest/staff/visits/"+visit+"/pin")
 ]);
 const all=[orders,requests,approvals,pin];
 const denied=all.find(x=>x.status==="rejected"&&x.reason instanceof FloorRequestError&&x.reason.status===401);
 if(denied&&denied.status==="rejected")throw denied.reason;
 return {table,canOpen,
  orders:orders.status==="fulfilled"?orders.value:null,
  requests:requests.status==="fulfilled"?requests.value:null,
  approvals:approvals.status==="fulfilled"?approvals.value:null,
  pin:pin.status==="fulfilled"?pin.value:null};
}
function Stat({title,value,locale}:{title:string;value:string;locale:import("@dineflow/shared").Locale}){
 const rtl=direction(locale)==="rtl";
 return <View style={styles.stat}><Text style={[styles.statLabel,{textAlign:rtl?"right":"left"}]}>{title}</Text>
  <Text style={[styles.statValue,{textAlign:rtl?"right":"left"}]} numberOfLines={3}>{value}</Text>
 </View>;
}
export default function TableDetails(){
 const {id}=useLocalSearchParams<{id:string}>(),{locale}=useLocale(),rtl=direction(locale)==="rtl";
 const insets=useSafeAreaInsets(),loader=useCallback(()=>{
  if(!id||typeof id!=="string")return Promise.reject(new Error("INVALID_TABLE"));
  return getDetails(id);
 },[id]);
 const {data,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen("table-"+id,loader,12000);
 const [party,setParty]=useState("2"),[action,setAction]=useState<Action>(null);
 const [notice,setNotice]=useState(""),[mutationError,setMutationError]=useState("");
 const [showPin,setShowPin]=useState(false);
 const operationRef=useRef(false);
 const table=data?.table??null,ops=tableOperations(table,data?.canOpen??false);
 const canAct=!!table&&!action&&!refreshing;
 const partyCheck=table?seatingValidation(party,table.seats):"invalid";
 const requestCount=data?.requests?.total??null;
 const approvalCount=data?.approvals?.total??null;
 const orderCount=visitOrderCount(data?.orders?.rounds??null);
 const displayName=table?.assignedWaiterName??m24(locale,"unassigned");
 useEffect(()=>{
  if(table)setParty(String(Math.min(table.seats,2)));
 },[table?.id,table?.seats]);
 useEffect(()=>{
  if(!showPin)return;
  const timer=setTimeout(()=>setShowPin(false),20000);
  return()=>clearTimeout(timer);
 },[showPin]);
 useFocusEffect(useCallback(()=>()=>{setShowPin(false);},[]));
 const onRefresh=()=>{setNotice("");setMutationError("");void refresh(true);};
 const actionError=(e:unknown)=>{
  if(e instanceof FloorRequestError){
   if(e.status===401){router.replace("/sign-in");return m24(locale,"noPermission");}
   if(e.code==="VERSION_CONFLICT"||e.code==="VISIT_ACTIVE"||e.code==="VISIT_CLOSED"||
     e.code==="ALREADY_HANDLED"||e.code==="INVALID_STATE")return m24(locale,"updatedElsewhere");
   if(e.code==="NOT_ASSIGNED"||e.code==="FORBIDDEN")return m24(locale,"noPermission");
   if(e.code==="CAPACITY_REVIEW")return m24(locale,"capacityExceeded");
   if(e.status===404)return m24(locale,"invalidTable");
  }
  return e instanceof Error?e.message:m24(locale,"noConnection");
 };
 async function mutation(kind:Action,task:()=>Promise<unknown>,success:string){
  if(operationRef.current)return;
  operationRef.current=true;setAction(kind);setMutationError("");setNotice("");
  try{const result=await task();setShowPin(false);
   const repeated=kind==="seat"&&!!result&&typeof result==="object"&&"created" in result&&result.created===false;
   setNotice(repeated?m24(locale,"alreadySeated"):success);await refresh(true);}
  catch(e){setMutationError(actionError(e));await refresh(true);}
  finally{operationRef.current=false;setAction(null);}
 }
 function confirmSeat(){
  if(!table||!ops.canSeat||!canAct)return;
  if(partyCheck!=="ok"){setMutationError(m24(locale,partyCheck==="capacity"?"capacityExceeded":"maxParty"));return;}
  Alert.alert(m24(locale,"seating"),m24(locale,"seatingConfirm"),[
   {text:m24(locale,"cancel"),style:"cancel"},
   {text:m24(locale,"seatGuests"),onPress:()=>{
    if(!table)return;
    void mutation("seat",async()=>{
     const result=await floorRequest<{created:boolean;visit:{id:string}}>(
      "/api/floor/visits/tables/"+encodeURIComponent(table.id)+"/open",
      {method:"POST",body:{partySize:Number(party)}});
    },m24(locale,"seated"));
   }}]);
 }
 function confirmClean(){
  if(!table||!ops.canClean||!canAct)return;
  Alert.alert(m24(locale,"cleaning"),m24(locale,"confirmClean"),[
   {text:m24(locale,"cancel"),style:"cancel"},
   {text:m24(locale,"cleaned"),onPress:()=>{
    if(!table)return;void mutation("clean",()=>floorRequest(
     "/api/floor/tables/"+encodeURIComponent(table.id)+"/ready",
     {method:"POST",body:{version:table.version}}),m24(locale,"cleanedSuccess"));
   }}]);
 }
 function confirmRotate(){
  if(!table?.visitId||!data?.pin||!ops.canServe||!canAct)return;
  Alert.alert(m24(locale,"pinRotate"),m24(locale,"pinRotateWarning"),[
   {text:m24(locale,"cancel"),style:"cancel"},
   {text:m24(locale,"confirm"),style:"destructive",onPress:()=>{
    if(!table.visitId||!data.pin)return;
    const version=data.pin.version;
    void mutation("pin",()=>floorRequest(
     "/api/guest/staff/visits/"+encodeURIComponent(table.visitId!)+"/pin/rotate",
     {method:"POST",body:{version}}),m24(locale,"pinRotated"));
   }}]);
 }
 function actOnRequest(request:ServiceRequest,next:"acknowledge"|"resolve"){
  if(!table?.visitId||!ops.canServe||!serviceActionAllowed(request,next)||!canAct)return;
  const execute=()=>{
   void mutation("request",()=>floorRequest(
    "/api/service/requests/"+encodeURIComponent(request.id)+"/transition",
    {method:"POST",body:{version:request.version,action:next,note:""}}),
    m24(locale,next==="resolve"?"resolved":"acknowledged"));
  };
  if(next==="resolve"){
   Alert.alert(m24(locale,"resolve"),m24(locale,"confirmResolve"),[
    {text:m24(locale,"cancel"),style:"cancel"},
    {text:m24(locale,"confirm"),onPress:execute}]);
  }else execute();
 }
 const statusDescription=table?.status==="occupied"?m24(locale,"visitInProgress"):
  table?.status==="cleaning"?m24(locale,"needsCleaning"):
  table?.status==="available"?m24(locale,"availableToSeat"):m24(locale,"outOfService");
 const accent=table?.status==="occupied"?"#B07A2C":
  table?.status==="cleaning"?"#6479AB":
  table?.status==="disabled"?theme.muted:theme.brand;
 const statusBg=table?.status==="occupied"?"#FFF5E5":
  table?.status==="cleaning"?"#F0F2FC":
  table?.status==="disabled"?"#F1F4F2":theme.brandSoft;
 const openRequestList=()=>router.push({pathname:"/requests",params:{tableId:table?.id??""}});
 return <ScrollView style={styles.root} contentContainerStyle={[styles.content,{paddingTop:insets.top+12}]}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brand}/>}>
  <View style={[styles.header,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable accessibilityRole="button" accessibilityLabel={m24(locale,"backFloor")}
    onPress={()=>router.back()} style={styles.iconButton}>
    <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={21} color={theme.brand}/></Pressable>
   <View style={styles.titleWrap}><Text style={[styles.caption,{textAlign:rtl?"right":"left"}]}>
    DINEFLOW / SERVICE</Text><Text style={[styles.headerTitle,{textAlign:rtl?"right":"left"}]}>
    {m24(locale,"tableDetails")}</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel={m24(locale,"refresh")}
    onPress={onRefresh} style={styles.iconButton} disabled={refreshing||!!action}>
    {refreshing?<ActivityIndicator color={theme.brand} size="small"/>:
     <Ionicons name="refresh-outline" size={21} color={theme.brand}/>}</Pressable>
  </View>
  <LiveNotice locale={locale} error={error} lastUpdated={lastUpdated} hasData={!!data} onRetry={onRefresh}/>
  {loading&&!data?<LoadingPanel locale={locale} label={m24(locale,"loading")}/>:
   table?<><View style={[styles.hero,{backgroundColor:statusBg}]}>
    <View style={[styles.heroTop,{flexDirection:rtl?"row-reverse":"row"}]}>
     <View style={[styles.heroSymbol,{backgroundColor:"#fff"}]}>
      <Ionicons name="restaurant-outline" size={26} color={accent}/></View>
     <View style={styles.heroBody}><Text style={[styles.heroLabel,{textAlign:rtl?"right":"left"}]}>
      {m24(locale,"serviceState")}</Text>
      <Text style={[styles.tableName,{textAlign:rtl?"right":"left"}]}>{table.label}</Text></View>
     <View style={[styles.badge,{borderColor:accent+"33"}]}>
      <Text style={[styles.badgeText,{color:accent}]}>{f(locale,table.status)}</Text></View>
    </View>
    <Text style={[styles.heroHint,{textAlign:rtl?"right":"left"}]}>{statusDescription}</Text>
    <View style={[styles.assignment,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name={data?.canOpen?"checkmark-circle-outline":"lock-closed-outline"} size={17} color={accent}/>
     <Text style={styles.assignmentText}>{data?.canOpen?m24(locale,"yourTable"):
      table.assignedWaiterId?m24(locale,"otherWaiter"):m24(locale,"unassigned")}</Text></View>
   </View>
   <SectionHeading locale={locale} title={m24(locale,"tableOverview")} icon="information-circle-outline"/>
   <View style={styles.infoCard}>
    <View style={styles.statsGrid}>
     <Stat title={m24(locale,"location")} value={table.sectionName} locale={locale}/>
     <Stat title={m24(locale,"capacity")} value={String(table.seats)} locale={locale}/>
     <Stat title={m24(locale,"assignedWaiter")} value={displayName} locale={locale}/>
     <Stat title={m24(locale,"tableStatus")} value={f(locale,table.status)} locale={locale}/>
     {table.visitId&&<><Stat title={m24(locale,"guestCount")} value={String(table.visitPartySize??"—")} locale={locale}/>
      <Stat title={m24(locale,"visitStarted")} value={since(table.visitOpenedAt,locale)} locale={locale}/></>}
    </View>
    {!!table.notes&&<View style={styles.noteCard}><Text style={styles.noteTitle}>{m24(locale,"notes")}</Text>
     <Text style={styles.noteBody}>{table.notes}</Text></View>}
   </View>
   {!data?.canOpen&&<View style={styles.explanation}>
    <Ionicons name="lock-closed-outline" size={20} color="#9B712A"/>
    <Text style={styles.explanationText}>{m24(locale,table.assignedWaiterId?"permissions":"noAssigned")}</Text>
   </View>}
   {ops.canSeat&&<View style={styles.sectionCard}>
    <SectionHeading locale={locale} title={m24(locale,"seating")} icon="people-outline"/>
    <Text style={[styles.help,{textAlign:rtl?"right":"left"}]}>{m24(locale,"seatingHint")}</Text>
    <View style={[styles.seatRow,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Pressable accessibilityRole="button" accessibilityLabel={o5(locale,"decrease")} disabled={!!action||Number(party)<=1}
      style={[styles.stepper,Number(party)<=1&&styles.disabled]} onPress={()=>setParty(String(Math.max(1,(Number(party)||1)-1)))}>
      <Ionicons name="remove-outline" size={23} color={theme.brand}/></Pressable>
     <View style={styles.seatField}><Text style={styles.seatCaption}>{m24(locale,"partySize")}</Text>
      <TextInput keyboardType="number-pad" value={party} maxLength={2} editable={!action}
       selectTextOnFocus accessibilityLabel={m24(locale,"partySize")}
       onChangeText={setParty} style={styles.seatInput}/></View>
     <Pressable accessibilityRole="button" accessibilityLabel={o5(locale,"increase")} disabled={!!action||Number(party)>=Math.min(table.seats,30)}
      style={[styles.stepper,Number(party)>=Math.min(table.seats,30)&&styles.disabled]}
      onPress={()=>setParty(String(Math.min(Math.min(table.seats,30),(Number(party)||0)+1)))}>
      <Ionicons name="add-outline" size={23} color={theme.brand}/></Pressable>
    </View>
    <Text style={styles.capacityHint}>{m24(locale,"capacity")} · {table.seats}</Text>
    {partyCheck!=="ok"&&<Text accessibilityRole="alert" style={styles.validation}>
     {m24(locale,partyCheck==="capacity"?"capacityExceeded":"maxParty")}</Text>}
    <Pressable accessibilityRole="button" disabled={!canAct||partyCheck!=="ok"} onPress={confirmSeat}
     style={[styles.primary,(!canAct||partyCheck!=="ok")&&styles.disabled]}>
     {action==="seat"?<ActivityIndicator color="#fff" size="small"/>:<Ionicons name="people-outline" size={19} color="#fff"/>}
     <Text style={styles.primaryText}>{m24(locale,"seatGuests")}</Text></Pressable>
   </View>}
   {ops.canClean&&<View style={styles.sectionCard}>
    <SectionHeading locale={locale} title={m24(locale,"cleaning")} icon="sparkles-outline"/>
    <Text style={[styles.help,{textAlign:rtl?"right":"left"}]}>{m24(locale,"confirmClean")}</Text>
    <Pressable accessibilityRole="button" onPress={confirmClean} disabled={!canAct}
     style={[styles.primary,!canAct&&styles.disabled]}>
     {action==="clean"?<ActivityIndicator color="#fff" size="small"/>:
      <Ionicons name="checkmark-done-outline" color="#fff" size={20}/>}
     <Text style={styles.primaryText}>{m24(locale,"cleaned")}</Text></Pressable>
   </View>}
   {ops.canServe&&table.visitId&&<><View style={styles.sectionCard}>
    <SectionHeading locale={locale} title={m24(locale,"visitOrders")} icon="receipt-outline"
     actionLabel={m24(locale,"browseMenu")} onAction={()=>router.push("/(main)/menu")}/>
    {data?.orders?<><View style={[styles.orderTotals,{flexDirection:rtl?"row-reverse":"row"}]}>
      <View style={styles.totalBody}><Text style={[styles.totalCaption,{textAlign:rtl?"right":"left"}]}>
       {m24(locale,"visitEstimate")}</Text>
       <Text style={[styles.totalNumber,{textAlign:rtl?"right":"left"}]}>
        {price(data.orders.estimateMinor,locale)}</Text>
       <Text style={[styles.totalNote,{textAlign:rtl?"right":"left"}]}>
        {m24(locale,"orderEstimateHint")}</Text></View>
      <Text style={styles.roundCount}>{orderCount} {m24(locale,"rounds")}</Text>
     </View>
     {data.orders.rounds.length?<View style={styles.roundList}>{data.orders.rounds.map(r=>
      <Pressable key={r.id} accessibilityRole="button" onPress={()=>
       router.push({pathname:"/order/[id]",params:{id:r.id}})}
       style={[styles.round,{flexDirection:rtl?"row-reverse":"row"}]}>
       <View style={styles.roundIcon}><Ionicons name={readyToDeliver(r.status)?"checkmark-circle-outline":"receipt-outline"}
        size={21} color={theme.brand}/></View>
       <View style={styles.roundBody}>
        <Text style={[styles.roundTitle,{textAlign:rtl?"right":"left"}]}>
         {m24(locale,"round")} #{r.roundNumber} · {o5(locale,r.status as "accepted"|"voided")}</Text>
        <Text style={[styles.roundMeta,{textAlign:rtl?"right":"left"}]}>
         {new Date(r.createdAt).toLocaleString(locale,{hour:"2-digit",minute:"2-digit"})}
         {" · "}{price(r.totalMinor,locale)}</Text></View>
       <Ionicons name={rtl?"chevron-back":"chevron-forward"} color={theme.brand} size={19}/>
      </Pressable>)}</View>:<Text style={styles.help}>{m24(locale,"noRounds")}</Text>}
     {data.orders.rounds.some(r=>readyToDeliver(r.status))&&
      <QuickLink locale={locale} icon="checkmark-circle-outline" label={m24(locale,"openReady")}
       description={m24(locale,"orderAttention")}
       onPress={()=>router.push({pathname:"/(main)/orders",params:{tab:"ready"}})}/>}
     {!!data.orders.unsettled&&<View style={[styles.explanation,{backgroundColor:"#F4F6FC",borderColor:"#DADFEF"}]}>
       <Ionicons name="wallet-outline" color="#596BA1" size={20}/>
       <Text style={[styles.explanationText,{color:"#596BA1"}]}>{m24(locale,"settlementHint")}</Text>
      </View>}</>:<Text style={styles.help}>{m24(locale,"orderUnavailable")}</Text>}
    <Pressable accessibilityRole="button" onPress={()=>
     router.push({pathname:"/visit/[id]/new-order",params:{id:table.visitId!}})}
     disabled={!!action} style={[styles.primary,!!action&&styles.disabled]}>
     <Ionicons name="add-circle-outline" color="#fff" size={20}/>
     <Text style={styles.primaryText}>{m24(locale,"addOrder")}</Text></Pressable>
   </View>
   <View style={styles.sectionCard}>
    <SectionHeading locale={locale} title={m24(locale,"serviceRequests")} icon="notifications-outline"
     actionLabel={m24(locale,"viewRequests")} onAction={openRequestList}/>
    {data?.requests?<><View style={[styles.listCount,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Text style={styles.countLabel}>{m24(locale,"activeRequests")}</Text>
      <Text style={styles.countValue}>{requestCount}</Text></View>
     {data.requests.items.length?data.requests.items.slice(0,3).map(req=><View key={req.id} style={styles.requestCard}>
      <View style={[styles.requestHead,{flexDirection:rtl?"row-reverse":"row"}]}>
       <View style={styles.requestIcon}><Ionicons name={req.type==="water"?"water-outline":
        req.type==="bill"?"receipt-outline":"notifications-outline"} size={20} color={theme.brand}/></View>
       <View style={styles.requestBody}><Text style={[styles.requestTitle,{textAlign:rtl?"right":"left"}]}>
        {sr8(locale,req.type)}</Text>
        <Text style={[styles.requestMeta,{textAlign:rtl?"right":"left"}]}>
         {sr8(locale,req.status==="pending"?"pending":"acknowledged")}
         {" · "}{new Date(req.createdAt).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})}</Text>
       </View></View>
      {!!req.note&&<Text style={styles.help}>{req.note}</Text>}
      {req.type==="bill"&&<Text style={styles.help}>{sr8(locale,"billPreference")}:
       {" "}{sr8(locale,req.billPreference)}</Text>}
      <View style={[styles.requestActions,{flexDirection:rtl?"row-reverse":"row"}]}>
       {serviceActionAllowed(req,"acknowledge")&&<Pressable accessibilityRole="button"
        disabled={!!action} style={[styles.secondary,!!action&&styles.disabled]}
        onPress={()=>actOnRequest(req,"acknowledge")}>
        <Ionicons name="checkmark-outline" size={17} color={theme.brand}/>
        <Text style={styles.secondaryText}>{m24(locale,"acknowledge")}</Text></Pressable>}
       {serviceActionAllowed(req,"resolve")&&<Pressable accessibilityRole="button"
        disabled={!!action} style={[styles.secondary,!!action&&styles.disabled]}
        onPress={()=>actOnRequest(req,"resolve")}>
        <Ionicons name="checkmark-done-outline" size={17} color={theme.brand}/>
        <Text style={styles.secondaryText}>{m24(locale,"resolve")}</Text></Pressable>}
      </View>
     </View>):<Text style={styles.help}>{m24(locale,"noRequests")}</Text>}
     {data.requests.total>3&&<Text style={styles.help}>{m24(locale,"serviceRequestWarning")}</Text>}
    </>:<Text style={styles.help}>{m24(locale,"requestUnavailable")}</Text>}
    <Pressable accessibilityRole="button" onPress={openRequestList}
     style={styles.secondaryWide}><Text style={styles.secondaryText}>
      {m24(locale,"viewRequests")}</Text>
     <Ionicons name={rtl?"arrow-back":"arrow-forward"} size={17} color={theme.brand}/></Pressable>
   </View>
   <View style={styles.sectionCard}>
    <SectionHeading locale={locale} title={m24(locale,"guestApprovals")} icon="people-outline"/>
    {data?.approvals?<Text style={styles.help}>
     {approvalCount?m24(locale,"underReview")+" · "+approvalCount:m24(locale,"noApprovals")}</Text>:
     <Text style={styles.help}>{m24(locale,"approvalsUnavailable")}</Text>}
    <QuickLink locale={locale} icon="checkmark-done-circle-outline" label={m24(locale,"reviewApprovals")}
     badge={approvalCount} onPress={()=>
       router.push({pathname:"/approvals",params:{tableId:table.id}})}/>
   </View>
   <View style={[styles.pinCard,{gap:12}]}>
    <SectionHeading locale={locale} title={m24(locale,"guestCode")} icon="key-outline"/>
    <Text style={[styles.help,{textAlign:rtl?"right":"left"}]}>{m24(locale,"guestCodeHint")}</Text>
    <View style={styles.pinBox}><Text style={styles.pinText} selectable={false}>
     {showPin&&data?.pin?data.pin.pin:m24(locale,"pinHidden")}</Text></View>
    {data?.pin?<><View style={[styles.pinControl,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Pressable accessibilityRole="button" accessibilityLabel={m24(locale,showPin?"pinHide":"pinReveal")}
      onPress={()=>setShowPin(v=>!v)} style={styles.secondary}>
      <Ionicons name={showPin?"eye-off-outline":"eye-outline"} size={19} color={theme.brand}/>
      <Text style={styles.secondaryText}>{m24(locale,showPin?"pinHide":"pinReveal")}</Text>
     </Pressable>
     <Pressable accessibilityRole="button" onPress={confirmRotate} disabled={!!action}
      style={[styles.secondary,!!action&&styles.disabled]}>
      {action==="pin"?<ActivityIndicator color={theme.brand} size="small"/>:
       <Ionicons name="refresh-circle-outline" size={19} color={theme.brand}/>}
      <Text style={styles.secondaryText}>{m24(locale,"pinRotate")}</Text>
     </Pressable></View>
     <Text style={styles.pinHint}>{m24(locale,"pinExpires")}</Text>
    </>:<Text style={styles.help}>{m24(locale,"pinUnavailable")}</Text>}
    <View style={[styles.pinWarning,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name="shield-checkmark-outline" size={18} color={theme.brand}/>
     <Text style={styles.pinWarningText}>{m24(locale,"showPrivate")}{" "}{m24(locale,"guestPinSafety")}</Text>
    </View>
   </View></>}
   {!!notice&&<View accessibilityRole="alert" style={styles.success}>
    <Ionicons name="checkmark-circle-outline" color={theme.brand} size={20}/>
    <Text style={styles.successText}>{notice}</Text></View>}
   {!!mutationError&&<View accessibilityRole="alert" style={styles.actionError}>
    <Ionicons name="alert-circle-outline" color={theme.danger} size={20}/>
    <Text style={styles.actionErrorText}>{mutationError}</Text>
    <Pressable accessibilityRole="button" onPress={onRefresh}>
     <Text style={styles.retryText}>{m24(locale,"refresh")}</Text></Pressable></View>}
   </>:<EmptyPanel locale={locale} icon="grid-outline"
    title={m24(locale,"invalidTable")} onAction={onRefresh} actionLabel={m24(locale,"retry")}/>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},
 content:{paddingHorizontal:17,paddingBottom:45,gap:16},
 header:{alignItems:"center",gap:11},
 iconButton:{height:43,width:43,backgroundColor:theme.brandSoft,borderRadius:13,
  justifyContent:"center",alignItems:"center"},
 titleWrap:{flex:1,minWidth:0,gap:4},
 caption:{color:theme.brand,fontSize:10,fontWeight:"900",letterSpacing:1},
 headerTitle:{color:theme.ink,fontSize:22,fontWeight:"900"},
 hero:{borderWidth:1,borderColor:"#DDE8E0",borderRadius:19,padding:19,gap:11},
 heroTop:{alignItems:"center",gap:11},
 heroSymbol:{height:48,width:48,borderRadius:15,alignItems:"center",justifyContent:"center"},
 heroBody:{gap:5,flex:1},
 heroLabel:{fontSize:11,color:theme.muted,fontWeight:"700"},
 tableName:{fontSize:27,fontWeight:"900",color:theme.ink},
 badge:{alignSelf:"flex-start",paddingHorizontal:10,paddingVertical:7,borderRadius:99,borderWidth:1,backgroundColor:"#FFFFFFBB"},
 badgeText:{fontSize:11,fontWeight:"800",textAlign:"center"},
 heroHint:{fontSize:12,color:theme.muted,lineHeight:19},
 assignment:{alignItems:"center",gap:8,padding:11,borderRadius:10,backgroundColor:"#FFFFFFAA"},
 assignmentText:{fontSize:12,fontWeight:"800",color:theme.ink},
 infoCard:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,borderRadius:17,padding:16,gap:14},
 statsGrid:{flexDirection:"row",flexWrap:"wrap",gap:10},
 stat:{backgroundColor:"#F8FBF9",borderWidth:1,borderColor:"#E4EEE6",borderRadius:11,
  padding:12,width:"48%",flexGrow:1,gap:6},
 statLabel:{fontSize:11,color:theme.muted,fontWeight:"700"},
 statValue:{fontSize:14,color:theme.ink,fontWeight:"800",lineHeight:21},
 noteCard:{padding:13,backgroundColor:"#FFF8EB",borderRadius:10,gap:6},
 noteTitle:{fontSize:11,fontWeight:"800",color:"#936526"},
 noteBody:{fontSize:12,lineHeight:20,color:theme.ink},
 explanation:{flexDirection:"row",gap:10,padding:14,alignItems:"flex-start",borderWidth:1,
  borderColor:"#E8D9BC",backgroundColor:"#FFF9EE",borderRadius:12},
 explanationText:{flex:1,fontSize:12,lineHeight:20,color:"#8D6B32"},
 sectionCard:{backgroundColor:"#fff",padding:16,borderWidth:1,borderColor:theme.border,
  borderRadius:17,gap:13},
 help:{color:theme.muted,fontSize:12,lineHeight:20},
 seatRow:{justifyContent:"center",alignItems:"center",gap:12},
 seatField:{gap:5,flex:1,maxWidth:160},
 seatCaption:{fontSize:11,fontWeight:"800",color:theme.muted,textAlign:"center"},
 seatInput:{borderColor:"#C7E4D1",borderWidth:1,backgroundColor:theme.brandSoft,
  borderRadius:13,minHeight:58,fontSize:26,fontWeight:"900",color:theme.ink,textAlign:"center"},
 stepper:{width:53,height:53,borderRadius:13,backgroundColor:theme.brandSoft,borderWidth:1,
  borderColor:"#D6EBDC",alignItems:"center",justifyContent:"center"},
 capacityHint:{fontSize:11,fontWeight:"700",color:theme.muted,textAlign:"center"},
 validation:{fontSize:12,color:theme.danger,textAlign:"center"},
 primary:{minHeight:51,borderRadius:13,backgroundColor:theme.brand,paddingHorizontal:15,
  flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9},
 primaryText:{fontSize:14,fontWeight:"900",color:"#fff"},
 disabled:{opacity:.42},
 orderTotals:{padding:15,alignItems:"center",gap:10,borderRadius:13,backgroundColor:theme.brandSoft},
 totalBody:{flex:1,gap:4},
 totalCaption:{fontSize:11,color:theme.brand,fontWeight:"800"},
 totalNumber:{fontSize:23,fontWeight:"900",color:theme.ink},
 totalNote:{fontSize:10,color:theme.muted,lineHeight:17},
 roundCount:{color:theme.brand,fontSize:12,fontWeight:"800"},
 roundList:{gap:8},
 round:{alignItems:"center",gap:11,borderRadius:11,padding:12,
  borderWidth:1,borderColor:theme.border,backgroundColor:"#FCFEFC"},
 roundIcon:{height:36,width:36,backgroundColor:theme.brandSoft,borderRadius:11,
  alignItems:"center",justifyContent:"center"},
 roundBody:{flex:1,minWidth:0,gap:4},
 roundTitle:{fontSize:12,fontWeight:"800",color:theme.ink},
 roundMeta:{fontSize:11,color:theme.muted,lineHeight:17},
 listCount:{justifyContent:"space-between",alignItems:"center",padding:11,backgroundColor:theme.brandSoft,borderRadius:10},
 countLabel:{fontSize:12,fontWeight:"800",color:theme.brand},
 countValue:{fontSize:19,fontWeight:"900",color:theme.brand},
 requestCard:{borderWidth:1,borderColor:theme.border,borderRadius:12,padding:13,gap:10,backgroundColor:"#FCFEFC"},
 requestHead:{alignItems:"center",gap:10},
 requestIcon:{height:38,width:38,backgroundColor:theme.brandSoft,borderRadius:11,
  justifyContent:"center",alignItems:"center"},
 requestBody:{flex:1,gap:5},
 requestTitle:{fontSize:14,fontWeight:"850",color:theme.ink},
 requestMeta:{fontSize:11,color:theme.muted},
 requestActions:{alignItems:"center",gap:8,flexWrap:"wrap"},
 secondary:{minHeight:43,flexDirection:"row",alignItems:"center",justifyContent:"center",
  paddingHorizontal:11,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:"#D5E7D9",
  backgroundColor:theme.brandSoft,gap:7},
 secondaryText:{fontSize:12,fontWeight:"800",color:theme.brand},
 secondaryWide:{minHeight:45,flexDirection:"row",alignItems:"center",justifyContent:"center",
  borderWidth:1,borderColor:theme.border,borderRadius:11,gap:8},
 pinCard:{backgroundColor:"#F5FAF6",borderWidth:1,borderColor:"#C5E4D0",borderRadius:17,padding:16},
 pinBox:{backgroundColor:"#fff",borderRadius:13,paddingVertical:20,
  borderWidth:1,borderColor:"#D5E9DC"},
 pinText:{fontSize:33,fontWeight:"900",color:theme.brand,letterSpacing:6,textAlign:"center"},
 pinControl:{alignItems:"center",gap:8,flexWrap:"wrap"},
 pinWarning:{gap:9,alignItems:"flex-start",padding:11,borderRadius:11,backgroundColor:"#EAF7EE"},
 pinWarningText:{flex:1,fontSize:11,color:theme.brand,lineHeight:18},
 pinHint:{fontSize:11,color:theme.muted},
 success:{flexDirection:"row",alignItems:"center",gap:10,padding:14,borderRadius:12,
  backgroundColor:"#E8F6EC",borderWidth:1,borderColor:"#C5E7D0"},
 successText:{flex:1,fontSize:12,color:theme.brand,fontWeight:"800",lineHeight:19},
 actionError:{flexDirection:"row",alignItems:"center",gap:9,flexWrap:"wrap",
  borderRadius:12,padding:14,backgroundColor:"#FFF0EC",borderWidth:1,borderColor:"#F1CEC5"},
 actionErrorText:{flex:1,minWidth:100,fontSize:12,color:theme.danger,lineHeight:18},
 retryText:{fontSize:12,color:theme.brand,fontWeight:"800"},
});
