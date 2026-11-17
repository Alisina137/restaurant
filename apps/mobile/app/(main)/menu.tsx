import {useCallback,useMemo,useState} from "react";
import {FlatList,Modal,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {floorRequest} from "../../src/floor-api";
import {type Board} from "../../src/floor";
import {o5} from "../../src/order-copy";
import {type MenuData,type MenuItem,nameOf,price} from "../../src/order-types";
import {MenuCard,useMenuCookie} from "../../src/order-ui";
import {m23} from "../../src/mobile23-copy";
import {LiveNotice,LoadingPanel,EmptyPanel,Pill,ScreenHeader,SectionHeading} from "../../src/mobile23-ui";
import {useLiveScreen} from "../../src/use-live-screen";
type Catalog={menu:MenuData;floor:Board};
async function loadCatalog():Promise<Catalog>{
 const [menu,floor]=await Promise.all([
  floorRequest<MenuData>("/api/menu/catalog"),
  floorRequest<Board>("/api/floor/tables/board")]);
 return {menu,floor};
}
export default function WaiterMenu(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl",cookie=useMenuCookie();
 const [search,setSearch]=useState(""),[category,setCategory]=useState(""),
  [item,setItem]=useState<MenuItem|null>(null),[showTables,setShowTables]=useState(false),
  [preselect,setPreselect]=useState<string|null>(null);
 const loader=useCallback(loadCatalog,[]);
 const {data,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen("catalog",loader,30000);
 const active=useMemo(()=>data?.floor.tables.filter(t=>
  t.status==="occupied"&&t.visitId&&t.assignedWaiterId===data.floor.actorId)??[],[data]);
 const catalog=data?.menu;
 const filtered=useMemo(()=>catalog?.items.filter(dish=>
  (!category||dish.categoryId===category)&&
  (!search.trim()||[dish.nameFa,dish.namePs,dish.nameEn].some(value=>
   value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))))??[],[catalog,category,search]);
 const filterActive=!!category||!!search.trim();
 const reset=()=>{setSearch("");setCategory("");};
 function pickVisit(visitId:string,itemId?:string){
  setItem(null);setShowTables(false);
  router.push({pathname:"/visit/[id]/new-order",params:{id:visitId,...(itemId?{itemId}:{})}});
 }
 const header=<View style={styles.headerStack}>
  <ScreenHeader locale={locale} title={m23(locale,"menu")} caption="DINEFLOW / CATALOG"
   subtitle={m23(locale,"menuDescription")} onRefresh={()=>void refresh(true)} refreshing={refreshing}/>
  <LiveNotice locale={locale} error={error} lastUpdated={lastUpdated} hasData={!!data}
   onRetry={()=>void refresh(true)}/>
  <View style={styles.summary}>
   <View style={[styles.summaryRow,{flexDirection:rtl?"row-reverse":"row"}]}>
    <View style={styles.summaryIcon}><Ionicons name="restaurant-outline" size={20} color={theme.brand}/></View>
    <View style={styles.summaryInfo}>
     <Text style={[styles.summaryTitle,{textAlign:rtl?"right":"left"}]}>{m23(locale,"chooseTable")}</Text>
     <Text style={[styles.summaryDetail,{textAlign:rtl?"right":"left"}]}>{active.length}
      {" · "}{o5(locale,"pickTable")}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:showTables}}
      style={styles.toggle} onPress={()=>setShowTables(!showTables)}>
      <Ionicons name={showTables?"chevron-up":"chevron-down"} color={theme.brand} size={19}/>
    </Pressable>
   </View>
   {showTables&&<View style={styles.visits}>
    {active.length?active.map(table=><Pressable key={table.id} accessibilityRole="button"
     onPress={()=>pickVisit(table.visitId!,preselect??undefined)}
     style={[styles.visit,{flexDirection:rtl?"row-reverse":"row"}]}>
     <View style={styles.visitIcon}><Ionicons name="grid-outline" size={18} color={theme.brand}/></View>
     <View style={styles.visitInfo}>
      <Text style={[styles.visitTitle,{textAlign:rtl?"right":"left"}]}>{table.label}</Text>
      <Text style={[styles.visitMeta,{textAlign:rtl?"right":"left"}]}>{table.sectionName}
       {" · "}{table.visitPartySize??table.seats} {m23(locale,"guests")}</Text>
     </View>
     <Ionicons name={rtl?"arrow-back":"arrow-forward"} size={18} color={theme.brand}/>
    </Pressable>):
     <EmptyPanel locale={locale} icon="grid-outline" title={m23(locale,"noActiveVisit")}
      hint={m23(locale,"noTablesToOrder")} onAction={()=>router.push("/(main)/tables")}
      actionLabel={m23(locale,"viewFloor")}/>}
   </View>}
  </View>
  <SectionHeading locale={locale} title={m23(locale,"catalog")} icon="book-outline"/>
  <View style={styles.searchBox}>
   <Ionicons name="search-outline" size={19} color={theme.muted}/>
   <TextInput value={search} onChangeText={setSearch} accessibilityLabel={m23(locale,"searchDishes")}
    placeholder={m23(locale,"searchDishes")} placeholderTextColor={theme.muted}
    autoCorrect={false} style={[styles.search,{textAlign:rtl?"right":"left"}]}/>
   {search.length>0&&<Pressable accessibilityRole="button" accessibilityLabel={m23(locale,"clear")}
    onPress={()=>setSearch("")}><Ionicons name="close-circle" size={20} color={theme.muted}/></Pressable>}
  </View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
   <Pill locale={locale} label={m23(locale,"all")} selected={!category}
    count={catalog?.items.length??0} onPress={()=>setCategory("")}/>
   {catalog?.categories.map(cat=><Pill key={cat.id} locale={locale} selected={category===cat.id}
    label={nameOf(cat,locale)}
    count={catalog.items.filter(row=>row.categoryId===cat.id).length}
    onPress={()=>setCategory(cat.id)}/>)}
  </ScrollView>
  <View style={[styles.results,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Text style={styles.resultsText}>{m23(locale,"matching")}: {filtered.length} {m23(locale,"dishes")}</Text>
   {filterActive&&<Pressable accessibilityRole="button" onPress={reset} style={styles.reset}>
    <Ionicons name="refresh-outline" color={theme.brand} size={15}/>
    <Text style={styles.resetText}>{m23(locale,"resetFilters")}</Text>
   </Pressable>}
  </View>
 </View>;
 return <View style={styles.root}>
 <FlatList data={filtered} keyExtractor={dish=>dish.id}
  style={styles.listRoot} contentContainerStyle={styles.content}
  ListHeaderComponent={header}
  renderItem={({item:dish})=><MenuCard cookie={cookie} item={dish} locale={locale}
   readOnly onPress={()=>setItem(dish)}/>}
  ListEmptyComponent={loading?<LoadingPanel locale={locale} label={m23(locale,"loadingMenu")}/>:
   <EmptyPanel locale={locale} icon="restaurant-outline" title={m23(locale,"noMenu")}
    hint={m23(locale,"cardHint")} onAction={filterActive?reset:undefined}
    actionLabel={m23(locale,"resetFilters")}/>}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh(true)} tintColor={theme.brand}/>}
 />
 <Modal visible={!!item} transparent animationType="slide" onRequestClose={()=>setItem(null)}>
  <View style={styles.modalBackdrop}>
   <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={m23(locale,"cancel")}
    onPress={()=>setItem(null)}/>
   <View style={styles.modalCard}>
    <View style={[styles.modalTop,{flexDirection:rtl?"row-reverse":"row"}]}>
     <View style={styles.modalHeading}>
      <Text style={styles.modalCaption}>{m23(locale,"details")}</Text>
      <Text style={[styles.modalTitle,{textAlign:rtl?"right":"left"}]}>
       {item?nameOf(item,locale):""}</Text></View>
     <Pressable accessibilityRole="button" accessibilityLabel={m23(locale,"cancel")}
      onPress={()=>setItem(null)} style={styles.modalClose}>
      <Ionicons name="close" size={22} color={theme.ink}/></Pressable>
    </View>
    <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
     {!!item?.description&&<Text style={[styles.help,{textAlign:rtl?"right":"left"}]}>{item.description}</Text>}
     {item?.soldOut&&<View style={styles.soldOut}><Text style={styles.soldOutText}>{m23(locale,"soldOut")}</Text></View>}
     {item&&<Text style={[styles.modalPrice,{textAlign:rtl?"right":"left"}]}>{price(item.priceMinor,locale)}</Text>}
     {!!item?.allergens.length&&<Text style={styles.help}>
      {o5(locale,"allergens")}: {item.allergens.join(", ")}</Text>}
     {!!item&&catalog?.groups.filter(group=>item.groupIds.includes(group.id)).map(group=>
      <View key={group.id} style={styles.modalGroup}>
       <Text style={[styles.groupTitle,{textAlign:rtl?"right":"left"}]}>{nameOf(group,locale)}
        {" · "}{group.minSelections}–{group.maxSelections}</Text>
       <Text style={[styles.help,{textAlign:rtl?"right":"left"}]}>
        {group.options.map(option=>nameOf(option,locale)+" +"+price(option.deltaMinor,locale)).join(" · ")}</Text>
      </View>)}
    </ScrollView>
    <Pressable accessibilityRole="button" disabled={!item||item.soldOut}
     style={[styles.modalAction,(!item||item.soldOut)&&styles.disabled]} onPress={()=>{
      if(!item)return;setPreselect(item.id);setItem(null);
      if(active.length===1)pickVisit(active[0]!.visitId!,item.id);
      else setShowTables(true);
     }}>
     <Ionicons name="restaurant-outline" size={18} color="#fff"/>
     <Text style={styles.modalActionText}>{m23(locale,"chooseTable")}</Text>
    </Pressable>
   </View>
  </View>
 </Modal>
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},listRoot:{flex:1},
 content:{paddingHorizontal:17,paddingBottom:31,gap:12},headerStack:{gap:14,marginBottom:6},
 summary:{backgroundColor:theme.brandSoft,padding:15,borderRadius:16,
  borderWidth:1,borderColor:"#D6ECDD",gap:11},
 summaryRow:{alignItems:"center",gap:12},
 summaryIcon:{height:44,width:44,borderRadius:12,backgroundColor:"#fff",alignItems:"center",justifyContent:"center"},
 summaryInfo:{flex:1,gap:3},summaryTitle:{fontSize:13,fontWeight:"900",color:theme.brand},
 summaryDetail:{fontSize:11,color:theme.muted},toggle:{padding:9,borderRadius:11,backgroundColor:"#fff"},
 visits:{gap:9},visit:{padding:13,alignItems:"center",gap:11,borderRadius:12,
  backgroundColor:"#fff",borderWidth:1,borderColor:"#D5E6DC"},
 visitIcon:{height:35,width:35,borderRadius:10,backgroundColor:theme.brandSoft,
  alignItems:"center",justifyContent:"center"},
 visitInfo:{flex:1,gap:4},visitTitle:{fontSize:14,fontWeight:"900",color:theme.ink},
 visitMeta:{fontSize:11,color:theme.muted},
 searchBox:{height:49,flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:13,
  backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,borderRadius:13},
 search:{flex:1,fontSize:14,color:theme.ink},
 chips:{gap:8,paddingVertical:4,alignItems:"center"},
 results:{alignItems:"center",justifyContent:"space-between",gap:10},
 resultsText:{fontSize:12,color:theme.muted,fontWeight:"700"},
 reset:{flexDirection:"row",gap:6,alignItems:"center"},
 resetText:{fontSize:11,fontWeight:"800",color:theme.brand},
 modalBackdrop:{flex:1,backgroundColor:"#092820A8",justifyContent:"flex-end"},
 modalCard:{backgroundColor:"#fff",borderTopLeftRadius:23,borderTopRightRadius:23,
  padding:20,paddingBottom:32,maxHeight:"88%",gap:15},
 modalTop:{alignItems:"flex-start",justifyContent:"space-between",gap:10},
 modalHeading:{gap:5,flex:1},
 modalCaption:{fontSize:11,fontWeight:"900",color:theme.brand},
 modalTitle:{fontWeight:"900",color:theme.ink,fontSize:21,lineHeight:29},
 modalClose:{height:39,width:39,borderRadius:12,backgroundColor:theme.background,
  alignItems:"center",justifyContent:"center"},
 modalBody:{flexGrow:0},modalBodyContent:{gap:11,paddingBottom:7},
 help:{fontSize:13,color:theme.muted,lineHeight:22},
 modalPrice:{fontSize:24,fontWeight:"900",color:theme.brand},
 modalGroup:{borderTopWidth:1,borderTopColor:theme.border,paddingTop:12,gap:8},
 groupTitle:{fontWeight:"800",color:theme.ink,fontSize:14},
 soldOut:{backgroundColor:"#FFF2EB",padding:10,borderRadius:9},
 soldOutText:{fontSize:12,fontWeight:"800",color:theme.danger},
 modalAction:{minHeight:50,backgroundColor:theme.brand,borderRadius:13,
  flexDirection:"row",justifyContent:"center",alignItems:"center",gap:9},
 modalActionText:{fontSize:13,fontWeight:"900",color:"#fff"},
 disabled:{opacity:.45}
});
