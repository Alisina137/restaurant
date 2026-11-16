import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useLocalSearchParams} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../../../src/locale";
import {theme} from "../../../src/theme";
import {floorRequest,FloorRequestError} from "../../../src/floor-api";
import {fetchIdentity,type Identity} from "../../../src/api";
import {o5} from "../../../src/order-copy";
import {type MenuData,type MenuItem,type CartLine,type OrderDraft,price,cartPrice,nameOf,newKey} from "../../../src/order-types";
import {freshDraft,readDraft,saveDraft,clearDraft} from "../../../src/order-drafts";
import {MenuCard,ItemOptionsModal,useMenuCookie} from "../../../src/order-ui";

type VisitResult={visit:{id:string;tableId:string;waiterId:string;status:"open"|"closed"}};
type TableResult={table:{label:string;visitId:string|null;assignedWaiterId:string|null}};
const emptyMenu:MenuData={version:0,currency:"AFN",categories:[],items:[],groups:[]};
export default function NewOrder(){
 const {id}=useLocalSearchParams<{id:string}>(),{locale}=useLocale(),rtl=direction(locale)==="rtl",cookie=useMenuCookie();
 const [identity,setIdentity]=useState<Identity|null>(null),[menu,setMenu]=useState<MenuData>(emptyMenu);
 const [tableName,setTableName]=useState(""),[tab,setTab]=useState<"menu"|"cart">("menu");
 const [search,setSearch]=useState(""),[category,setCategory]=useState(""),[draft,setDraft]=useState<OrderDraft>(freshDraft);
 const [pick,setPick]=useState<{item:MenuItem;index?:number}|null>(null);
 const [loading,setLoading]=useState(true),[sending,setSending]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const loaded=useRef(false),submitted=useRef(false);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   if(!id||typeof id!=="string")throw new Error(o5(locale,"visitClosed"));
   const [who,visit,catalog]=await Promise.all([
    fetchIdentity(),floorRequest<VisitResult>("/api/floor/visits/"+encodeURIComponent(id)),
    floorRequest<MenuData>("/api/menu/catalog")]);
   if(who.role!=="waiter"||visit.visit.status!=="open"||visit.visit.waiterId!==who.user.id)
     throw new Error(o5(locale,"noPermission"));
   const table=await floorRequest<TableResult>("/api/floor/tables/"+encodeURIComponent(visit.visit.tableId));
   if(table.table.visitId!==id)throw new Error(o5(locale,"visitClosed"));
   setIdentity(who);setMenu(catalog);setTableName(table.table.label);
   const cached=await readDraft(who.user.id,who.tenantId!,id);
   if(cached&&!submitted.current)setDraft(cached);
   loaded.current=true;
  }catch(e){setError(e instanceof Error?e.message:o5(locale,"offline"));}
  finally{setLoading(false);}
 },[id,locale]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  if(!loaded.current||!identity?.tenantId||!id||submitted.current)return;
  const timer=setTimeout(()=>{void saveDraft(identity.user.id,identity.tenantId!,id,draft)
    .catch(()=>{/* Draft remains editable in memory; explicit Save shows any storage failure. */});},550);
  return()=>clearTimeout(timer);
 },[draft,id,identity]);
 function updateDraft(change:(old:OrderDraft)=>OrderDraft){
  setNotice("");setError("");
  setDraft(old=>({...change(old),idempotencyKey:newKey()}));
 }
 function addLine(line:CartLine){
  updateDraft(old=>{
   if(pick?.index!==undefined){return {...old,lines:old.lines.map((r,i)=>i===pick.index?line:r)};}
   if(old.lines.length>=40){setError(o5(locale,"invalid"));return old;}
   const sig=(l:CartLine)=>JSON.stringify({itemId:l.itemId,itemVersion:l.itemVersion,note:l.note,selections:l.selections});
   const at=old.lines.findIndex(r=>sig(r)===sig(line)&&r.quantity+line.quantity<=99);
   return {...old,lines:at>=0?old.lines.map((r,i)=>i===at?{...r,quantity:r.quantity+line.quantity}:r):
      [...old.lines,line]};
  });
  setTab("cart");
 }
 async function saveLocal(){
  if(!identity?.tenantId||!id)return;
  try{await saveDraft(identity.user.id,identity.tenantId,id,draft);setNotice(o5(locale,"draftSaved"));}
  catch(e){setError(e instanceof Error?e.message:o5(locale,"failed"));}
 }
 async function submit(){
  if(sending||!id||!identity?.tenantId)return;
  if(!draft.lines.length){setError(o5(locale,"emptyCart"));return;}
  setError("");setNotice("");setSending(true);
  try{
   await saveDraft(identity.user.id,identity.tenantId,id,draft);
   const body={idempotencyKey:draft.idempotencyKey,note:draft.note,lines:draft.lines};
   const response=await floorRequest<{created:boolean;round:{id:string}}>("/api/orders/visits/"+encodeURIComponent(id)+"/rounds",
     {method:"POST",body});
   submitted.current=true;
   await clearDraft(identity.user.id,identity.tenantId,id);
   router.replace({pathname:"/order/[id]",params:{id:response.round.id}});
  }catch(e){
   const code=e instanceof FloorRequestError?e.code:"";
   setError(["PRICE_CHANGED","MODIFIER_CHANGED","ITEM_UNAVAILABLE","INVALID_MODIFIERS"].includes(code)?
     o5(locale,"menuChanged"):code==="VISIT_LOCKED"?o5(locale,"visitClosed"):
     e instanceof Error?e.message:o5(locale,"sendFailed"));
  }finally{setSending(false);}
 }
 const filtered=menu.items.filter(item=>(!category||item.categoryId===category)&&
   (!search.trim()||[item.nameFa,item.namePs,item.nameEn,item.description].some(s=>s.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))));
 const total=draft.lines.reduce((n,l)=>n+(cartPrice(l,menu)??0),0);
 const missing=draft.lines.some(l=>cartPrice(l,menu)===null||
   menu.items.find(i=>i.id===l.itemId)?.version!==l.itemVersion||
   menu.items.find(i=>i.id===l.itemId)?.soldOut||
   l.selections.some(s=>menu.groups.find(g=>g.id===s.groupId)?.version!==s.version));
 return <View style={styles.root}>
  <View style={[styles.header,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable style={styles.navButton} onPress={()=>router.back()} accessibilityLabel={o5(locale,"back")}>
     <Ionicons name={rtl?"arrow-forward":"arrow-back"} color={theme.brand} size={23}/></Pressable>
   <View style={styles.headerText}><Text style={styles.eyebrow}>{o5(locale,"table")} {tableName||"…"}</Text>
     <Text style={styles.title}>{o5(locale,"newOrder")}</Text></View>
   <Pressable style={styles.navButton} onPress={()=>void load()} accessibilityLabel={o5(locale,"refresh")}>
     <Ionicons name="refresh-outline" size={22} color={theme.brand}/></Pressable>
  </View>
  <View style={styles.tabs}>
   {(["menu","cart"] as const).map(key=><Pressable key={key} onPress={()=>setTab(key)}
     style={[styles.tab,tab===key&&styles.tabActive]}>
     <Text style={[styles.tabText,tab===key&&styles.tabTextSelected]}>{o5(locale,key)} {key==="cart"&&draft.lines.length?"("+draft.lines.length+")":""}</Text>
    </Pressable>)}
  </View>
  {loading?<View style={styles.center}><ActivityIndicator size="large" color={theme.brand}/><Text>{o5(locale,"loading")}</Text></View>:
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    {tab==="menu"?<>
      <View style={styles.search}><Ionicons name="search" size={19} color={theme.muted}/>
       <TextInput style={[styles.searchInput,{textAlign:rtl?"right":"left"}]} value={search} onChangeText={setSearch}
         placeholder={o5(locale,"search")} placeholderTextColor={theme.muted}/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
       <Pressable onPress={()=>setCategory("")} style={[styles.chip,!category&&styles.chipActive]}><Text
         style={[styles.chipText,!category&&styles.chipTextActive]}>{o5(locale,"all")}</Text></Pressable>
       {menu.categories.map(c=><Pressable key={c.id} onPress={()=>setCategory(c.id)}
         style={[styles.chip,category===c.id&&styles.chipActive]}><Text style={[styles.chipText,category===c.id&&styles.chipTextActive]}>{nameOf(c,locale)}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.list}>{filtered.length?filtered.map(item=><MenuCard key={item.id} item={item} locale={locale}
        cookie={cookie} onPress={()=>{if(!item.soldOut)setPick({item});}}/>):
        <Text style={styles.empty}>{o5(locale,"empty")}</Text>}</View>
      <Text style={styles.helper}>{o5(locale,"estimated")}</Text>
    </>:<>
      {draft.lines.length?draft.lines.map((line,index)=>{
       const item=menu.items.find(i=>i.id===line.itemId);
       return <View key={index} style={styles.cartLine}>
        <View style={[styles.cartTop,{flexDirection:rtl?"row-reverse":"row"}]}>
         <Text style={styles.cartName}>{item?nameOf(item,locale):o5(locale,"unavailable")}</Text>
         <Pressable onPress={()=>updateDraft(old=>({...old,lines:old.lines.filter((_,i)=>i!==index)}))}
           accessibilityLabel={o5(locale,"remove")}><Ionicons name="trash-outline" color={theme.danger} size={22}/></Pressable></View>
        <Text style={styles.muted}>{line.selections.flatMap(s=>{
         const g=menu.groups.find(x=>x.id===s.groupId);return s.optionIds.map(id=>nameOf(g!.options.find(o=>o.id===id)!,locale));
        }).join(" · ")}{line.note?" · "+line.note:""}</Text>
        <View style={[styles.cartBottom,{flexDirection:rtl?"row-reverse":"row"}]}>
         <View style={styles.qty}>
          <Pressable onPress={()=>updateDraft(old=>({...old,lines:old.lines.map((r,i)=>i===index?{...r,quantity:Math.max(1,r.quantity-1)}:r)}))}>
           <Ionicons name="remove-circle-outline" size={27} color={theme.brand}/></Pressable>
          <Text style={styles.qtyNumber}>{line.quantity}</Text>
          <Pressable onPress={()=>updateDraft(old=>({...old,lines:old.lines.map((r,i)=>i===index?{...r,quantity:Math.min(99,r.quantity+1)}:r)}))}>
           <Ionicons name="add-circle-outline" size={27} color={theme.brand}/></Pressable></View>
         <Text style={styles.money}>{cartPrice(line,menu)===null?"—":price(cartPrice(line,menu)!,locale)}</Text>
         {item&&<Pressable onPress={()=>setPick({item,index})}><Text style={styles.edit}>{o5(locale,"edit")}</Text></Pressable>}
        </View>
       </View>;
      }):<View style={styles.emptyPanel}><Ionicons name="basket-outline" size={42} color={theme.muted}/>
       <Text style={styles.empty}>{o5(locale,"emptyCart")}</Text>
       <Pressable onPress={()=>setTab("menu")}><Text style={styles.edit}>{o5(locale,"showMenu")}</Text></Pressable></View>}
      {!!draft.lines.length&&<View style={styles.cartSummary}>
       <Text style={styles.summaryTitle}>{o5(locale,"summary")}</Text>
       <Text style={styles.muted}>{o5(locale,"noConfiguredFees")}</Text>
       <Text style={styles.total}>{o5(locale,"total")}: {price(total,locale)}</Text>
       <Text style={styles.helper}>{o5(locale,"estimated")}</Text>
       <Text style={styles.summaryTitle}>{o5(locale,"orderNote")}</Text>
       <TextInput multiline maxLength={500} style={[styles.note,{textAlign:rtl?"right":"left"}]}
         value={draft.note} onChangeText={v=>updateDraft(d=>({...d,note:v}))}
         placeholder={o5(locale,"specialInstructions")} placeholderTextColor={theme.muted}/>
       {missing&&<Text style={styles.errorText}>{o5(locale,"menuChanged")}</Text>}
      </View>}
    </>}
    {!!error&&<View style={styles.error}><Text style={styles.errorText}>{error}</Text>
      <Pressable onPress={()=>void load()}><Text style={styles.edit}>{o5(locale,"refresh")}</Text></Pressable></View>}
    {!!notice&&<Text style={styles.notice}>{notice}</Text>}
   </ScrollView>}
  <View style={styles.footer}>
   {tab==="menu"?<Pressable style={styles.mainButton} onPress={()=>setTab("cart")}>
     <Ionicons name="basket-outline" size={19} color="white"/><Text style={styles.mainText}>
       {o5(locale,"showCart")} · {draft.lines.length} · {price(total,locale)}</Text></Pressable>:
    <View style={styles.footerRow}>
     <Pressable onPress={()=>void saveLocal()} style={styles.secondaryButton}><Text style={styles.secondaryText}>{o5(locale,"saveDraft")}</Text></Pressable>
     <Pressable onPress={()=>void submit()} disabled={sending||!draft.lines.length||missing} style={[styles.mainButton,{flex:1},
       (sending||!draft.lines.length||missing)&&{opacity:.48}]}>
       {sending?<ActivityIndicator color="white"/>:<Ionicons name="send-outline" size={18} color="white"/>}
       <Text style={styles.mainText}>{sending?o5(locale,"sending"):o5(locale,"send")}</Text></Pressable>
    </View>}
  </View>
  <ItemOptionsModal key={pick?.item.id+"-"+(pick?.index??"new")} item={pick?.item??null} menu={menu} locale={locale}
    cookie={cookie} visible={!!pick} initial={pick?.index!==undefined?draft.lines[pick.index]:undefined}
    onClose={()=>setPick(null)} onAdd={addLine}/>
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background,paddingTop:51},
 header:{paddingHorizontal:17,paddingVertical:12,alignItems:"center",gap:13},
 navButton:{height:42,width:42,borderRadius:12,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center"},
 headerText:{flex:1},eyebrow:{color:theme.brand,fontSize:11,fontWeight:"800"},
 title:{fontSize:22,fontWeight:"800",color:theme.ink},
 tabs:{flexDirection:"row",marginHorizontal:17,padding:4,borderRadius:13,backgroundColor:"#E5EDE8",marginBottom:11},
 tab:{flex:1,alignItems:"center",borderRadius:10,padding:12},
 tabActive:{backgroundColor:"white"},tabText:{color:theme.muted,fontWeight:"800",fontSize:14},
 tabTextSelected:{color:theme.brand},
 content:{paddingHorizontal:17,paddingBottom:45,gap:14},
 center:{padding:70,alignItems:"center",gap:12},
 search:{flexDirection:"row",backgroundColor:"white",borderRadius:12,borderWidth:1,borderColor:theme.border,
  alignItems:"center",paddingHorizontal:12,marginTop:6,gap:9},
 searchInput:{flex:1,minHeight:48,color:theme.ink},
 filters:{gap:8,paddingVertical:4},
 chip:{borderWidth:1,borderColor:theme.border,paddingVertical:9,paddingHorizontal:13,backgroundColor:"white",borderRadius:19},
 chipActive:{backgroundColor:theme.brandSoft,borderColor:"#B6DFC5"},
 chipText:{color:theme.muted,fontWeight:"700",fontSize:12},
 chipTextActive:{color:theme.brand},
 list:{gap:11},
 empty:{textAlign:"center",fontSize:14,color:theme.muted,lineHeight:23},
 helper:{color:theme.muted,fontSize:12,lineHeight:19},
 footer:{backgroundColor:"white",padding:15,borderTopWidth:1,borderTopColor:theme.border,paddingBottom:25},
 mainButton:{flexDirection:"row",gap:8,paddingHorizontal:14,minHeight:51,borderRadius:13,
   justifyContent:"center",alignItems:"center",backgroundColor:theme.brand},
 mainText:{color:"white",fontWeight:"800",fontSize:13},
 footerRow:{flexDirection:"row",gap:9,alignItems:"center"},
 secondaryButton:{borderWidth:1,borderColor:theme.border,paddingHorizontal:14,paddingVertical:15,borderRadius:13},
 secondaryText:{fontWeight:"800",fontSize:12,color:theme.brand},
 cartLine:{backgroundColor:"white",borderWidth:1,borderColor:theme.border,borderRadius:14,padding:15,gap:12},
 cartTop:{alignItems:"center",justifyContent:"space-between",gap:10},
 cartName:{fontSize:16,color:theme.ink,fontWeight:"800",flex:1},
 muted:{color:theme.muted,fontSize:12,lineHeight:19},
 cartBottom:{alignItems:"center",gap:12,justifyContent:"space-between"},
 qty:{flexDirection:"row",alignItems:"center",gap:8},qtyNumber:{fontWeight:"800",fontSize:16,color:theme.ink},
 money:{fontSize:13,fontWeight:"800",color:theme.ink},edit:{color:theme.brand,fontSize:13,fontWeight:"800"},
 emptyPanel:{alignItems:"center",paddingVertical:64,gap:15},
 cartSummary:{backgroundColor:"white",borderWidth:1,borderColor:theme.border,borderRadius:14,padding:18,gap:13},
 summaryTitle:{fontSize:15,fontWeight:"800",color:theme.ink},
 total:{fontSize:19,fontWeight:"800",color:theme.brand},
 note:{minHeight:76,textAlignVertical:"top",padding:12,borderWidth:1,borderColor:theme.border,borderRadius:11,color:theme.ink},
 error:{backgroundColor:"#FFF2F2",borderRadius:11,padding:13,gap:9},
 errorText:{color:theme.danger,fontSize:13},
 notice:{color:theme.brand,fontWeight:"800"}
});
