import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ActivityIndicator,Alert,AppState,FlatList,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {direction} from "@dineflow/shared";
import {useLocale} from "../../../src/locale";
import {theme} from "../../../src/theme";
import {floorRequest,FloorRequestError} from "../../../src/floor-api";
import {fetchIdentity,type Identity} from "../../../src/api";
import {o5} from "../../../src/order-copy";
import {m25,type Mobile25Key} from "../../../src/mobile25-copy";
import {type MenuData,type MenuItem,type CartLine,type OrderDraft,price,nameOf,cartPrice} from "../../../src/order-types";
import {freshDraft,readDraft,saveDraft,clearDraft} from "../../../src/order-drafts";
import {addCartLine,reviewCart,issueForLine,setLineQuantity,removeLine,setOrderNote} from "../../../src/mobile25-cart";
import {MenuCard,ItemOptionsModal,useMenuCookie} from "../../../src/order-ui";
import {LiveNotice,LoadingPanel,EmptyPanel,Pill} from "../../../src/mobile23-ui";

type VisitResult={visit:{id:string;tableId:string;waiterId:string;status:"open"|"closed"}};
type TableResult={table:{label:string;visitId:string|null;assignedWaiterId:string|null}};
type Context={identity:Identity;menu:MenuData;tableName:string};
type Row={kind:"dish";item:MenuItem}|{kind:"cart";line:CartLine;index:number};
type Pick={item:MenuItem;index?:number};
const knownCodes=["PRICE_CHANGED","MODIFIER_CHANGED","ITEM_UNAVAILABLE","INVALID_MODIFIERS"] as const;
const EMPTY_DRAFT=()=>freshDraft();
export default function NewOrder(){
 const {id,itemId}=useLocalSearchParams<{id:string;itemId?:string}>();
 const {locale}=useLocale(),rtl=direction(locale)==="rtl",safe=useSafeAreaInsets(),cookie=useMenuCookie();
 const [ctx,setCtx]=useState<Context|null>(null),[tab,setTab]=useState<"menu"|"cart">("menu");
 const [search,setSearch]=useState(""),[category,setCategory]=useState("");
 const [draft,setDraft]=useState<OrderDraft>(EMPTY_DRAFT);
 const [pick,setPick]=useState<Pick|null>(null);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const [sending,setSending]=useState(false),[blocked,setBlocked]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[lastUpdated,setLastUpdated]=useState<number|null>(null);
 const [saveStatus,setSaveStatus]=useState<"saving"|"saved"|"failed">("saved");
 const ctxRef=useRef<Context|null>(null),generation=useRef(0),mounted=useRef(false);
 const restored=useRef<string|null>(null),preselected=useRef<string|null>(null);
 const sent=useRef(false),sendingRef=useRef(false),editRevision=useRef(0);
 const review=useMemo(()=>ctx?reviewCart(draft,ctx.menu):null,[draft,ctx]);
 const count=draft.lines.reduce((n,l)=>n+l.quantity,0);
 const subtotal=review?.subtotalMinor??null;
 const estimate=subtotal===null?"—":price(subtotal,locale);

 const load=useCallback(async(quiet=false)=>{
  if(sendingRef.current)return;
  const n=++generation.current;
  if(!ctxRef.current)setLoading(true);else if(!quiet)setRefreshing(true);
  try{
   if(!id||typeof id!=="string")throw new Error(o5(locale,"visitClosed"));
   const [identity,visit,menu]=await Promise.all([
    fetchIdentity(),floorRequest<VisitResult>("/api/floor/visits/"+encodeURIComponent(id)),
    floorRequest<MenuData>("/api/menu/catalog")]);
   if(identity.role!=="waiter"||!identity.tenantId||
    visit.visit.waiterId!==identity.user.id||visit.visit.status!=="open")
    throw new FloorRequestError(403,"NOT_ASSIGNED","Not permitted to order for this visit");
   const {table}=await floorRequest<TableResult>("/api/floor/tables/"+encodeURIComponent(visit.visit.tableId));
   if(table.visitId!==id||table.assignedWaiterId!==identity.user.id)
    throw new FloorRequestError(409,"VISIT_LOCKED","Visit assignment changed");
   const updated={identity,menu,tableName:table.label};
   let cached:OrderDraft|null=null;
   if(restored.current!==id&&!sent.current)
    cached=await readDraft(identity.user.id,identity.tenantId,id);
   if(!mounted.current||n!==generation.current)return;
   ctxRef.current=updated;setCtx(updated);setBlocked(false);
   if(restored.current!==id){
    restored.current=id;
    if(cached){setDraft(cached);setNotice(m25(locale,"restored"));}
   }
   if(itemId&&preselected.current!==id+":"+itemId){
    const item=menu.items.find(x=>x.id===itemId);
    preselected.current=id+":"+itemId;
    if(item&&!item.soldOut)setPick({item});
   }
   setError("");setLastUpdated(Date.now());
  }catch(e){
   if(!mounted.current||n!==generation.current)return;
   if(e instanceof FloorRequestError&&e.status===401){router.replace("/sign-in");return;}
   if(e instanceof FloorRequestError&&[403,404,409].includes(e.status)){
    setBlocked(true);
    setError(e.code==="NOT_ASSIGNED"?m25(locale,"notAssigned"):m25(locale,"tableUnavailable"));
   }else setError(ctxRef.current?m25(locale,"refreshError"):m25(locale,"offline"));
  }finally{if(mounted.current&&n===generation.current){setLoading(false);setRefreshing(false);}}
 },[id,itemId,locale]);
 useFocusEffect(useCallback(()=>{
  mounted.current=true;void load();
  const interval=setInterval(()=>{if(AppState.currentState==="active")void load(true);},45000);
  const app=AppState.addEventListener("change",state=>{if(state==="active")void load(true);});
  return()=>{mounted.current=false;generation.current++;clearInterval(interval);app.remove();};
 },[load]));
 useEffect(()=>{
  if(!ctx?.identity.tenantId||restored.current!==id||sent.current||sendingRef.current)return;
  const revision=editRevision.current;
  const timer=setTimeout(()=>{
   void saveDraft(ctx.identity.user.id,ctx.identity.tenantId!,id!,draft).then(()=>{
    if(mounted.current&&revision===editRevision.current)setSaveStatus("saved");
   }).catch(()=>{
    if(mounted.current&&revision===editRevision.current)setSaveStatus("failed");
   });
  },650);
  return()=>clearTimeout(timer);
 },[ctx,draft,id]);
 function change(edit:(old:OrderDraft)=>OrderDraft){
  if(sendingRef.current||blocked)return;
  setDraft(old=>{
   const next=edit(old);
   if(next!==old){editRevision.current++;setSaveStatus("saving");}
   return next;
  });
  setNotice("");setError("");
 }
 function add(line:CartLine){
  if(sendingRef.current)return;
  const current=pick?.index;
  if(current===undefined&&draft.lines.length>=40){
   const next=addCartLine(draft,line);
   if(next===draft){setError(m25(locale,"overLimit"));return;}
  }
  change(old=>addCartLine(old,line,current));
  setTab("cart");setPick(null);
 }
 function choose(item:MenuItem,index?:number){
  if(sendingRef.current||blocked||item.soldOut)return;
  setPick({item,index});
 }
 function remove(index:number){
  if(sendingRef.current)return;
  Alert.alert(m25(locale,"remove"),m25(locale,"removeConfirm"),[
   {text:m25(locale,"cancel"),style:"cancel"},
   {text:m25(locale,"remove"),style:"destructive",onPress:()=>change(old=>removeLine(old,index))}
  ]);
 }
 async function save(){
  if(!ctx?.identity.tenantId||!id||sendingRef.current)return;
  setSaveStatus("saving");
  try{await saveDraft(ctx.identity.user.id,ctx.identity.tenantId,id,draft);
   setSaveStatus("saved");setNotice(m25(locale,"saveSuccess"));setError("");
  }catch{setSaveStatus("failed");setError(m25(locale,"saveFailed"));}
 }
 function sendConfirmation(){
  if(!ctx||!review?.valid||blocked||sendingRef.current)return;
  setTab("cart");
  Alert.alert(m25(locale,"confirmTitle"),
   m25(locale,"table")+" "+ctx.tableName+" · "+count+" "+m25(locale,"linePlural")+
   "\n"+m25(locale,"estimated")+": "+estimate+
   "\n\n"+m25(locale,"confirmBody"),[
    {text:m25(locale,"cancel"),style:"cancel"},
    {text:m25(locale,"confirmYes"),onPress:()=>void submit()}
   ]);
 }
 async function submit(){
  if(sendingRef.current||!id||!ctx?.identity.tenantId||!review?.valid||blocked)return;
  sendingRef.current=true;setSending(true);setError("");setNotice("");
  const snapshot=draft,tenantId=ctx.identity.tenantId,userId=ctx.identity.user.id;
  try{
   await saveDraft(userId,tenantId,id,snapshot);
   setSaveStatus("saved");
   // Reconfirm the same authorized visit and the newest published catalog before POST.
   const [visit,latest]=await Promise.all([
    floorRequest<VisitResult>("/api/floor/visits/"+encodeURIComponent(id)),
    floorRequest<MenuData>("/api/menu/catalog")]);
   if(visit.visit.status!=="open"||visit.visit.waiterId!==userId)
    throw new FloorRequestError(409,"VISIT_LOCKED","Visit closed or reassigned.");
   const latestReview=reviewCart(snapshot,latest);
   if(mounted.current)setCtx(old=>old?{...old,menu:latest}:old);
   if(!latestReview.valid){
    setTab("cart");setError(m25(locale,"validationFailed"));return;
   }
   const response=await floorRequest<{created:boolean;round:{id:string}}>(
    "/api/orders/visits/"+encodeURIComponent(id)+"/rounds",
    {method:"POST",body:{idempotencyKey:snapshot.idempotencyKey,
      note:snapshot.note,lines:snapshot.lines}});
   sent.current=true;
   try{await clearDraft(userId,tenantId,id);}catch{/* The same request key remains safe to replay. */}
   if(mounted.current){
    setNotice(m25(locale,response.created?"accepted":"alreadySent"));
    router.replace({pathname:"/order/[id]",params:{id:response.round.id}});
   }
  }catch(e){
   if(!mounted.current)return;
   if(e instanceof FloorRequestError&&e.status===401){router.replace("/sign-in");return;}
   const code=e instanceof FloorRequestError?e.code:"";
   if(knownCodes.some(value=>value===code)){
    setTab("cart");setError(m25(locale,"validationFailed"));
    // Refresh the displayed catalog without changing the draft or submission key.
    const currentCtx=ctxRef.current;
    if(currentCtx)void floorRequest<MenuData>("/api/menu/catalog")
     .then(menu=>{if(mounted.current){
      const next={...currentCtx,menu};ctxRef.current=next;setCtx(next);}})
     .catch(()=>{});
   }else if(code==="VISIT_LOCKED"||code==="NOT_ASSIGNED"){
    setBlocked(true);setError(m25(locale,code==="NOT_ASSIGNED"?"notAssigned":"visitClosed"));
   }else if(code==="IDEMPOTENCY_CONFLICT")setError(m25(locale,"keyConflict"));
   else if(e instanceof FloorRequestError)setError(e.message||m25(locale,"sendFailed"));
   else setError(m25(locale,"ambiguous"));
  }finally{sendingRef.current=false;if(mounted.current)setSending(false);}
 }
 const filtered=useMemo(()=>ctx?.menu.items.filter(item=>
  (!category||item.categoryId===category)&&
  (!search.trim()||[item.nameFa,item.nameEn,item.namePs,item.description].some(x=>
   x.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))))??[],
 [ctx,category,search]);
 const rows:Row[]=tab==="menu"?filtered.map(item=>({kind:"dish",item})):
  draft.lines.map((line,index)=>({kind:"cart",line,index}));
 const problems=(index:number)=>{
  const code=review?issueForLine(review,index):null;
  if(!code)return "";
  if(code==="sold_out")return m25(locale,"soldOutHint");
  if(code==="item_changed")return m25(locale,"itemChanged");
  if(code==="modifier_changed"||code==="options_invalid"||code==="groups_changed")
   return m25(locale,"modifierChanged");
  if(code==="line_note")return m25(locale,"noteTooLong");
  return m25(locale,"invalid");
 };
 const header=<View style={styles.headerStack}>
  <View style={[styles.header,{paddingTop:safe.top+11,flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable accessibilityRole="button" accessibilityLabel={m25(locale,"goBack")}
    onPress={()=>router.back()} style={styles.iconButton}>
    <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={21} color={theme.brand}/></Pressable>
   <View style={styles.titleBox}>
    <Text style={[styles.caption,{textAlign:rtl?"right":"left"}]}>DINEFLOW / ORDER</Text>
    <Text style={[styles.heading,{textAlign:rtl?"right":"left"}]}>{m25(locale,"title")}</Text>
    <Text style={[styles.description,{textAlign:rtl?"right":"left"}]}>{m25(locale,"subtitle")}</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel={m25(locale,"refresh")}
    onPress={()=>void load()} disabled={refreshing||sending} style={styles.iconButton}>
    {refreshing?<ActivityIndicator size="small" color={theme.brand}/>:
     <Ionicons name="refresh-outline" size={21} color={theme.brand}/>}</Pressable>
  </View>
  <View style={styles.tenantBar}>
   <View style={[styles.tenantRow,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.tenantIcon}><Ionicons name="restaurant-outline" size={21} color={theme.brand}/></View>
    <View style={styles.tenantLabels}><Text style={[styles.tenantCaption,{textAlign:rtl?"right":"left"}]}>
     {m25(locale,"visit")}</Text>
     <Text style={[styles.tenantName,{textAlign:rtl?"right":"left"}]}>
      {m25(locale,"table")} {ctx?.tableName??"—"}</Text></View>
    <View style={styles.draftBadge}><Ionicons name="lock-closed-outline" size={13} color={theme.brand}/>
     <Text style={styles.draftBadgeText}>{m25(locale,"draftLabel")}</Text></View>
   </View>
   {ctx&&<Text style={[styles.autosave,{textAlign:rtl?"right":"left"}]}>
    {saveStatus==="saved"?m25(locale,"savedLocally"):
     saveStatus==="failed"?m25(locale,"draftStorage"):m25(locale,"draftPending")}</Text>}
  </View>
  <View style={[styles.tabs,{flexDirection:rtl?"row-reverse":"row"}]}>
   {(["menu","cart"] as const).map(key=><Pressable key={key} accessibilityRole="tab"
    accessibilityState={{selected:tab===key}} onPress={()=>{setTab(key);setError("");}}
    style={[styles.tab,tab===key&&styles.tabActive]}>
    <Ionicons name={key==="menu"?"restaurant-outline":"basket-outline"}
     size={19} color={tab===key?theme.brand:theme.muted}/>
    <Text style={[styles.tabText,tab===key&&styles.tabTextActive]}>
     {m25(locale,key==="menu"?"catalog":"cart")}</Text>
    {key==="cart"&&draft.lines.length>0&&<Text style={styles.countBubble}>{draft.lines.length}</Text>}
   </Pressable>)}
  </View>
  <LiveNotice locale={locale} error={error} lastUpdated={lastUpdated}
   hasData={!!ctx} onRetry={()=>void load()}/>
  {!!notice&&<View accessibilityRole="alert" style={styles.success}>
   <Ionicons name="checkmark-circle-outline" size={19} color={theme.brand}/>
   <Text style={styles.successText}>{notice}</Text></View>}
  {blocked&&<View style={styles.blocked}>
   <Ionicons name="lock-closed-outline" size={20} color={theme.danger}/>
   <Text style={styles.blockedText}>{m25(locale,"tableUnavailable")}</Text>
   <Pressable accessibilityRole="button" onPress={()=>router.replace("/(main)/tables")}>
    <Text style={styles.actionLink}>{m25(locale,"goBack")}</Text></Pressable>
  </View>}
  {tab==="menu"?<View style={styles.menuControls}>
   <Text style={[styles.sectionTitle,{textAlign:rtl?"right":"left"}]}>{m25(locale,"catalog")}</Text>
   <Text style={[styles.description,{textAlign:rtl?"right":"left"}]}>{m25(locale,"menuDescription")}</Text>
   <View style={[styles.searchBox,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Ionicons name="search-outline" size={20} color={theme.muted}/>
    <TextInput accessibilityLabel={m25(locale,"search")} value={search}
     onChangeText={setSearch} autoCorrect={false}
     placeholder={m25(locale,"search")} placeholderTextColor={theme.muted}
     style={[styles.searchInput,{textAlign:rtl?"right":"left"}]}/>
    {!!search&&<Pressable accessibilityRole="button" accessibilityLabel={m25(locale,"clearFilters")}
     onPress={()=>setSearch("")}><Ionicons name="close-circle" size={21} color={theme.muted}/></Pressable>}
   </View>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
    <Pill locale={locale} label={m25(locale,"all")} selected={!category} onPress={()=>setCategory("")}
     count={ctx?.menu.items.length??0}/>
    {ctx?.menu.categories.map(cat=><Pill key={cat.id} locale={locale}
     label={nameOf(cat,locale)} selected={category===cat.id} onPress={()=>setCategory(cat.id)}
     count={ctx.menu.items.filter(item=>item.categoryId===cat.id).length}/>)}
   </ScrollView>
   <View style={[styles.results,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Text style={styles.muted}>{filtered.length} {m25(locale,"linePlural")}</Text>
    {(search||category)&&<Pressable accessibilityRole="button" onPress={()=>{setCategory("");setSearch("");}}>
     <Text style={styles.actionLink}>{m25(locale,"clearFilters")}</Text></Pressable>}
   </View>
  </View>:<View style={styles.cartIntro}>
   <Text style={[styles.sectionTitle,{textAlign:rtl?"right":"left"}]}>{m25(locale,"cartSummary")}</Text>
   <Text style={[styles.description,{textAlign:rtl?"right":"left"}]}>{m25(locale,"cartDescription")}</Text>
   <View style={[styles.summaryMini,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View><Text style={styles.summaryCaption}>{m25(locale,"lineCount")}</Text>
     <Text style={styles.summaryValue}>{count}</Text></View>
    <View><Text style={styles.summaryCaption}>{m25(locale,"estimated")}</Text>
     <Text style={styles.summaryValue}>{estimate}</Text></View>
   </View>
   {!!review?.issues.length&&<View accessibilityRole="alert" style={styles.warning}>
    <Ionicons name="alert-circle-outline" size={20} color="#9F6C21"/>
    <Text style={styles.warningText}>{m25(locale,"invalidLines")}</Text></View>}
  </View>}
 </View>;
 function render({item:row}:{item:Row}){
  if(row.kind==="dish")return <View style={styles.listCard}>
   <MenuCard item={row.item} locale={locale} cookie={cookie}
    onPress={()=>choose(row.item)}/></View>;
  const {line,index}=row;
  const item=ctx?.menu.items.find(x=>x.id===line.itemId);
  const issue=problems(index);
  const subtotal=review?.lineTotals[index]??null;
  const choiceText=line.selections.flatMap(selection=>{
   const group=ctx?.menu.groups.find(g=>g.id===selection.groupId);
   return selection.optionIds.map(id=>group?.options.find(o=>o.id===id)).filter(
    (o):o is NonNullable<typeof o>=>!!o).map(o=>nameOf(o,locale));
  }).join(" · ");
  return <View style={[styles.cartLine,!!issue&&styles.cartLineInvalid]}>
   <View style={[styles.cartTop,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.cartMain}><Text style={[styles.cartTitle,{textAlign:rtl?"right":"left"}]}>
     {item?nameOf(item,locale):m25(locale,"unavailable")}</Text>
     {!!choiceText&&<Text style={[styles.muted,{textAlign:rtl?"right":"left"}]}>{choiceText}</Text>}
     {!!line.note&&<Text style={[styles.noteText,{textAlign:rtl?"right":"left"}]}>{line.note}</Text>}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={m25(locale,"remove")}
     onPress={()=>remove(index)} disabled={sending} style={styles.trash}>
     <Ionicons name="trash-outline" color={theme.danger} size={21}/></Pressable>
   </View>
   {!!issue&&<View style={styles.itemWarning}><Ionicons name="alert-circle-outline" size={18} color={theme.danger}/>
    <Text style={styles.itemWarningText}>{issue}</Text></View>}
   <View style={[styles.cartBottom,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={[styles.quantityControls,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Pressable accessibilityRole="button" accessibilityLabel={m25(locale,"decrease")}
      disabled={sending||line.quantity<=1} style={[styles.qtyButton,(sending||line.quantity<=1)&&styles.disabled]}
      onPress={()=>change(d=>setLineQuantity(d,index,line.quantity-1))}>
      <Ionicons name="remove-outline" size={21} color={theme.brand}/></Pressable>
     <Text style={styles.qtyNumber}>{line.quantity}</Text>
     <Pressable accessibilityRole="button" accessibilityLabel={m25(locale,"increase")}
      disabled={sending||line.quantity>=99} style={[styles.qtyButton,(sending||line.quantity>=99)&&styles.disabled]}
      onPress={()=>change(d=>setLineQuantity(d,index,line.quantity+1))}>
      <Ionicons name="add-outline" size={21} color={theme.brand}/></Pressable>
    </View>
    <Text style={styles.lineAmount}>{subtotal===null?"—":price(subtotal,locale)}</Text>
    {item&&<Pressable accessibilityRole="button" onPress={()=>choose(item,index)}
     disabled={sending||blocked} style={styles.editButton}>
     <Ionicons name="create-outline" color={theme.brand} size={18}/>
     <Text style={styles.editLabel}>{m25(locale,"edit")}</Text></Pressable>}
   </View>
  </View>;
 }
 const footerContent=tab==="cart"&&draft.lines.length>0?<View style={styles.cartSummary}>
  <View style={[styles.totalRow,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Text style={styles.totalLabel}>{m25(locale,"estimated")}</Text>
   <Text style={styles.totalValue}>{estimate}</Text></View>
  <Text style={styles.footnote}>{m25(locale,"estimateHint")}</Text>
  <Text style={styles.fieldLabel}>{m25(locale,"noteLabel")}</Text>
  <TextInput multiline maxLength={500} textAlignVertical="top" value={draft.note}
   onChangeText={note=>change(old=>setOrderNote(old,note))} editable={!sending&&!blocked}
   accessibilityLabel={m25(locale,"noteLabel")}
   placeholder={m25(locale,"notesPlaceholder")} placeholderTextColor={theme.muted}
   style={[styles.noteInput,{textAlign:rtl?"right":"left"}]}/>
  <Text style={styles.hint}>{m25(locale,"safety")}</Text>
 </View>:null;
 return <View style={styles.root}>
  <FlatList style={styles.list} data={rows} keyExtractor={row=>row.kind==="dish"?
   "dish:"+row.item.id:"cart:"+row.index+":"+row.line.itemId}
   renderItem={render} ListHeaderComponent={header} ListFooterComponent={footerContent}
   contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load()}
    tintColor={theme.brand}/>}
   ListEmptyComponent={loading&&!ctx?<LoadingPanel locale={locale} label={m25(locale,"loading")}/>:
    <EmptyPanel locale={locale} icon={tab==="menu"?"restaurant-outline":"basket-outline"}
     title={tab==="menu"?m25(locale,"noDishes"):m25(locale,"cartEmpty")}
     hint={tab==="cart"?m25(locale,"cartEmptyHint"):undefined}
     onAction={tab==="cart"?()=>setTab("menu"):search||category?
      ()=>{setSearch("");setCategory("");}:!ctx?()=>void load():undefined}
     actionLabel={tab==="cart"?m25(locale,"addDishes"):m25(locale,"clearFilters")}/>}
  />
  <View style={[styles.footer,{paddingBottom:Math.max(safe.bottom,10)+10}]}>
   <View style={[styles.footerTotals,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.totalBox}><Text style={styles.footerCaption}>{m25(locale,"estimated")}</Text>
     <Text style={styles.footerAmount}>{estimate}</Text></View>
    <Text style={styles.footerCount}>{count} {m25(locale,"linePlural")}</Text>
   </View>
   {tab==="menu"?<Pressable accessibilityRole="button" onPress={()=>setTab("cart")}
     disabled={sending} style={styles.mainButton}>
     <Ionicons name="basket-outline" size={20} color="#fff"/>
     <Text style={styles.mainButtonText}>{m25(locale,"viewCart")}</Text></Pressable>:
    <View style={[styles.footerActions,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Pressable accessibilityRole="button" onPress={()=>void save()}
      disabled={sending||!ctx} style={[styles.secondaryButton,(sending||!ctx)&&styles.disabled]}>
      <Ionicons name="save-outline" size={18} color={theme.brand}/>
      <Text style={styles.secondaryText}>{m25(locale,"save")}</Text></Pressable>
     <Pressable accessibilityRole="button" onPress={sendConfirmation}
      disabled={sending||!ctx||!review?.valid||blocked}
      style={[styles.mainButton,{flex:1},(sending||!review?.valid||blocked)&&styles.disabled]}>
      {sending?<ActivityIndicator color="#fff"/>:
       <Ionicons name="send-outline" size={19} color="#fff"/>}
      <Text style={styles.mainButtonText}>{sending?m25(locale,"sending"):m25(locale,"send")}</Text>
     </Pressable>
    </View>}
  </View>
  <ItemOptionsModal key={pick?.item.id+"-"+(pick?.index??"new")}
   item={pick?.item??null} initial={pick?.index!==undefined?draft.lines[pick.index]:undefined}
   menu={ctx?.menu??{version:0,currency:"AFN",categories:[],items:[],groups:[]}}
   locale={locale} cookie={cookie} visible={!!pick} onClose={()=>setPick(null)}
   onAdd={add}/>
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},
 list:{flex:1},content:{paddingHorizontal:17,paddingBottom:30,gap:11},
 headerStack:{gap:14,marginBottom:6},
 header:{alignItems:"center",gap:11},iconButton:{width:44,height:44,borderRadius:13,
  alignItems:"center",justifyContent:"center",backgroundColor:theme.brandSoft},
 titleBox:{flex:1,gap:3,minWidth:0},
 caption:{fontSize:10,letterSpacing:1,color:theme.brand,fontWeight:"900"},
 heading:{fontSize:22,fontWeight:"900",color:theme.ink},
 description:{fontSize:12,color:theme.muted,lineHeight:19},
 tenantBar:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,
  borderRadius:16,padding:15,gap:10},
 tenantRow:{alignItems:"center",gap:11},
 tenantIcon:{height:43,width:43,borderRadius:12,backgroundColor:theme.brandSoft,
  justifyContent:"center",alignItems:"center"},
 tenantLabels:{flex:1,gap:4},
 tenantCaption:{fontSize:11,color:theme.muted},
 tenantName:{fontSize:16,fontWeight:"900",color:theme.ink},
 draftBadge:{backgroundColor:theme.brandSoft,borderRadius:99,paddingHorizontal:9,
  paddingVertical:7,flexDirection:"row",gap:6,alignItems:"center",maxWidth:125},
 draftBadgeText:{fontSize:10,fontWeight:"800",color:theme.brand,flexShrink:1},
 autosave:{fontSize:11,color:theme.muted},
 tabs:{padding:5,backgroundColor:"#E9F0EB",borderRadius:14,gap:5},
 tab:{flex:1,flexDirection:"row",gap:7,padding:12,borderRadius:11,alignItems:"center",
  justifyContent:"center",minHeight:45},
 tabActive:{backgroundColor:"#fff",elevation:2},
 tabText:{fontSize:13,fontWeight:"800",color:theme.muted},
 tabTextActive:{color:theme.brand},
 countBubble:{paddingHorizontal:6,paddingVertical:3,borderRadius:99,
  backgroundColor:theme.brand,color:"#fff",overflow:"hidden",fontSize:10,fontWeight:"900"},
 success:{padding:13,backgroundColor:"#EBF7EF",borderRadius:12,alignItems:"center",
  flexDirection:"row",gap:9},
 successText:{flex:1,fontSize:12,color:theme.brand,fontWeight:"800"},
 blocked:{padding:14,backgroundColor:"#FFF2EE",borderRadius:12,flexDirection:"row",
  gap:8,flexWrap:"wrap",alignItems:"center"},
 blockedText:{fontSize:11,color:theme.danger,flex:1},
 actionLink:{color:theme.brand,fontSize:11,fontWeight:"800"},
 menuControls:{gap:13},sectionTitle:{fontSize:17,fontWeight:"900",color:theme.ink},
 searchBox:{height:50,borderRadius:12,paddingHorizontal:13,backgroundColor:"#fff",
  borderWidth:1,borderColor:theme.border,gap:9,alignItems:"center"},
 searchInput:{flex:1,fontSize:14,color:theme.ink},
 filterRow:{gap:8,alignItems:"center",paddingVertical:3},
 results:{alignItems:"center",justifyContent:"space-between"},
 muted:{color:theme.muted,fontSize:11,lineHeight:18},
 cartIntro:{gap:11},
 summaryMini:{padding:14,backgroundColor:theme.brandSoft,borderRadius:13,justifyContent:"space-around",gap:8},
 summaryCaption:{fontSize:11,color:theme.muted,fontWeight:"700"},
 summaryValue:{fontSize:19,color:theme.brand,fontWeight:"900"},
 warning:{backgroundColor:"#FFF7EB",padding:13,borderRadius:11,flexDirection:"row",
  alignItems:"center",gap:9},
 warningText:{flex:1,color:"#8B6126",fontSize:12,lineHeight:18},
 listCard:{marginBottom:2},
 cartLine:{borderWidth:1,borderColor:theme.border,borderRadius:15,backgroundColor:"#fff",
  padding:15,gap:11},
 cartLineInvalid:{borderColor:"#E6AFA5",backgroundColor:"#FFFCFB"},
 cartTop:{alignItems:"flex-start",gap:10},
 cartMain:{flex:1,gap:6},
 cartTitle:{color:theme.ink,fontSize:15,fontWeight:"900"},
 noteText:{color:"#906A2A",fontSize:12,lineHeight:19},
 trash:{padding:9,borderRadius:11,backgroundColor:"#FFF1F0"},
 itemWarning:{flexDirection:"row",alignItems:"center",gap:7,
  padding:10,backgroundColor:"#FFF1EC",borderRadius:10},
 itemWarningText:{color:theme.danger,flex:1,fontSize:12,lineHeight:18},
 cartBottom:{gap:10,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"},
 quantityControls:{alignItems:"center",gap:8},
 qtyButton:{width:39,height:39,borderRadius:11,backgroundColor:theme.brandSoft,
  alignItems:"center",justifyContent:"center"},
 qtyNumber:{minWidth:24,fontSize:16,color:theme.ink,fontWeight:"900",textAlign:"center"},
 lineAmount:{fontSize:13,fontWeight:"900",color:theme.brand},
 editButton:{minHeight:42,flexDirection:"row",alignItems:"center",gap:5,
  backgroundColor:theme.brandSoft,borderRadius:10,paddingHorizontal:9},
 editLabel:{color:theme.brand,fontSize:11,fontWeight:"800"},
 cartSummary:{backgroundColor:"#fff",borderRadius:16,padding:17,
  borderWidth:1,borderColor:theme.border,gap:12},
 totalRow:{alignItems:"center",justifyContent:"space-between",gap:11},
 totalLabel:{color:theme.muted,fontWeight:"800",fontSize:12},
 totalValue:{fontSize:20,fontWeight:"900",color:theme.brand},
 footnote:{fontSize:11,color:theme.muted,lineHeight:19},
 fieldLabel:{fontSize:13,fontWeight:"800",color:theme.ink},
 noteInput:{minHeight:94,padding:12,borderRadius:11,borderColor:theme.border,
  borderWidth:1,fontSize:13,color:theme.ink,textAlignVertical:"top"},
 hint:{fontSize:11,color:theme.muted,lineHeight:17},
 footer:{backgroundColor:"#fff",borderTopWidth:1,borderTopColor:theme.border,
  paddingHorizontal:17,paddingTop:12,gap:10},
 footerTotals:{alignItems:"center",justifyContent:"space-between",gap:9},
 totalBox:{gap:4},footerCaption:{fontSize:10,color:theme.muted,fontWeight:"700"},
 footerAmount:{fontSize:20,fontWeight:"900",color:theme.ink},
 footerCount:{fontSize:11,color:theme.muted,fontWeight:"700"},
 footerActions:{alignItems:"center",gap:9},
 mainButton:{minHeight:52,borderRadius:12,backgroundColor:theme.brand,
  alignItems:"center",justifyContent:"center",flexDirection:"row",gap:8,paddingHorizontal:13},
 mainButtonText:{fontSize:12,fontWeight:"900",color:"#fff",textAlign:"center"},
 secondaryButton:{minHeight:52,borderRadius:12,paddingHorizontal:12,
  borderWidth:1,borderColor:theme.border,flexDirection:"row",
  gap:7,alignItems:"center",justifyContent:"center"},
 secondaryText:{fontSize:12,fontWeight:"800",color:theme.brand},
 disabled:{opacity:.45},
});
