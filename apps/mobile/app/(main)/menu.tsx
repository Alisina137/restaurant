import {useCallback,useState} from "react";
import {ActivityIndicator,Modal,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {floorRequest} from "../../src/floor-api";
import {type Board} from "../../src/floor";
import {o5} from "../../src/order-copy";
import {type MenuData,type MenuItem,nameOf,price} from "../../src/order-types";
import {MenuCard,useMenuCookie} from "../../src/order-ui";
export default function WaiterMenu(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl",cookie=useMenuCookie();
 const [data,setData]=useState<MenuData|null>(null),[board,setBoard]=useState<Board|null>(null),
   [search,setSearch]=useState(""),[category,setCategory]=useState(""),[item,setItem]=useState<MenuItem|null>(null),
   [showTables,setShowTables]=useState(false),[preselect,setPreselect]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const [catalog,floor]=await Promise.all([
     floorRequest<MenuData>("/api/menu/catalog"),floorRequest<Board>("/api/floor/tables/board")]);
     setData(catalog);setBoard(floor);
  }catch(e){setError(e instanceof Error?e.message:o5(locale,"offline"));}
  finally{setLoading(false);}
 },[locale]);
 useFocusEffect(useCallback(()=>{void load();},[load]));
 const active=board?.tables.filter(t=>t.visitId&&t.assignedWaiterId===board.actorId)??[];
 const filtered=data?.items.filter(i=>(!category||i.categoryId===category)&&
   (!search.trim()||[i.nameFa,i.namePs,i.nameEn].some(n=>n.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))))??[];
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}
   refreshControl={<RefreshControl refreshing={loading} tintColor={theme.brand} onRefresh={()=>void load()}/>}>
  <View style={[styles.header,{flexDirection:rtl?"row-reverse":"row"}]}>
   <View><Text style={styles.brand}>DINEFLOW</Text><Text style={styles.title}>{o5(locale,"catalog")}</Text></View>
   <Pressable onPress={()=>void load()} style={styles.icon} accessibilityLabel={o5(locale,"refresh")}>
    <Ionicons name="refresh-outline" size={23} color={theme.brand}/></Pressable></View>
  <View style={styles.callout}><Text style={styles.help}>{o5(locale,"menuOnly")}</Text>
   <Pressable onPress={()=>setShowTables(v=>!v)} style={styles.calloutAction}>
    <Ionicons name="restaurant-outline" size={18} color={theme.brand}/>
    <Text style={styles.calloutText}>{o5(locale,"pickTable")}</Text></Pressable>
   {showTables&&<View style={styles.tableChoices}>{active.length?active.map(t=>
     <Pressable key={t.id} onPress={()=>router.push({pathname:"/visit/[id]/new-order",params:{id:t.visitId!,...(preselect?{itemId:preselect}:{})}})}
       style={styles.table}><Text style={styles.tableText}>{t.label} · {t.sectionName}</Text>
       <Ionicons name="arrow-forward" size={17} color={theme.brand}/></Pressable>):
    <Text style={styles.help}>{o5(locale,"noTables")}</Text>}</View>}
  </View>
  <View style={styles.searchBox}><Ionicons name="search-outline" color={theme.muted} size={19}/>
    <TextInput value={search} onChangeText={setSearch} placeholder={o5(locale,"search")}
      placeholderTextColor={theme.muted} style={[styles.search,{textAlign:rtl?"right":"left"}]}/></View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
   <Pressable onPress={()=>setCategory("")} style={[styles.chip,!category&&styles.chipOn]}>
    <Text style={styles.chipText}>{o5(locale,"all")}</Text></Pressable>
   {data?.categories.map(cat=><Pressable key={cat.id} onPress={()=>setCategory(cat.id)}
     style={[styles.chip,category===cat.id&&styles.chipOn]}>
     <Text style={styles.chipText}>{nameOf(cat,locale)}</Text></Pressable>)}
  </ScrollView>
  {!!error&&<Text style={styles.error}>{error}</Text>}
  {loading&&!data?<ActivityIndicator color={theme.brand} size="large"/>:
    filtered.length?<View style={styles.list}>{filtered.map(x=><MenuCard key={x.id} cookie={cookie} item={x}
      locale={locale} readOnly onPress={()=>setItem(x)}/>)}</View>:
    <View style={styles.empty}><Ionicons name="restaurant-outline" size={37} color={theme.muted}/>
      <Text style={styles.help}>{o5(locale,"empty")}</Text></View>}
  <Modal visible={!!item} transparent animationType="slide" onRequestClose={()=>setItem(null)}>
   <View style={styles.modalBackdrop}><View style={styles.modalCard}>
     <View style={styles.modalTop}><Text style={styles.modalTitle}>{item?nameOf(item,locale):""}</Text>
       <Pressable onPress={()=>setItem(null)} accessibilityLabel={o5(locale,"cancel")}>
         <Ionicons name="close" size={23} color={theme.ink}/></Pressable></View>
     <Text style={styles.help}>{item?.description??""}</Text>
     {!!item?.allergens.length&&<Text style={styles.help}>{o5(locale,"allergens")}: {item.allergens.join(", ")}</Text>}
     <Text style={styles.modalPrice}>{item?price(item.priceMinor,locale):""}</Text>
     {!!item&&data?.groups.filter(g=>item.groupIds.includes(g.id)).map(group=>
       <View key={group.id} style={styles.modalGroup}>
        <Text style={styles.modalTitle}>{nameOf(group,locale)} · {group.minSelections}–{group.maxSelections}</Text>
        <Text style={styles.help}>{group.options.map(o=>nameOf(o,locale)+" +"+price(o.deltaMinor,locale)).join(" · ")}</Text>
       </View>)}
     <Pressable style={styles.modalAction} onPress={()=>{
       setPreselect(item?.id??null);setItem(null);setShowTables(true);}}>
      <Text style={styles.modalActionText}>{o5(locale,"pickTable")}</Text></Pressable>
   </View></View>
  </Modal>
 </ScrollView>;
}
const styles=StyleSheet.create({
 modalBackdrop:{flex:1,backgroundColor:"#08271E88",justifyContent:"flex-end"},
 modalCard:{padding:23,paddingBottom:37,borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:"white",gap:15},
 modalTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:15},
 modalTitle:{fontWeight:"800",color:theme.ink,fontSize:17,flex:1},
 modalPrice:{fontSize:23,fontWeight:"900",color:theme.brand},
 modalGroup:{borderTopWidth:1,borderTopColor:theme.border,paddingTop:13,gap:8},
 modalAction:{minHeight:49,alignItems:"center",justifyContent:"center",borderRadius:13,backgroundColor:theme.brand},
 modalActionText:{color:"white",fontWeight:"800"},

 root:{flex:1,backgroundColor:theme.background},content:{paddingTop:60,paddingHorizontal:17,paddingBottom:110,gap:15},
 header:{alignItems:"center",justifyContent:"space-between"},brand:{fontSize:11,fontWeight:"900",color:theme.brand,letterSpacing:1.4},
 title:{fontWeight:"800",fontSize:26,color:theme.ink},icon:{padding:12,backgroundColor:theme.brandSoft,borderRadius:13},
 callout:{backgroundColor:"#E8F5ED",borderRadius:16,padding:17,gap:11},help:{fontSize:13,color:theme.muted,lineHeight:22},
 calloutAction:{flexDirection:"row",alignItems:"center",gap:9},calloutText:{fontSize:13,color:theme.brand,fontWeight:"800"},
 tableChoices:{gap:8},table:{backgroundColor:"white",borderRadius:10,padding:13,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 tableText:{fontWeight:"800",color:theme.ink,fontSize:13},searchBox:{flexDirection:"row",gap:10,paddingHorizontal:12,alignItems:"center",backgroundColor:"white",borderWidth:1,borderColor:theme.border,borderRadius:12},
 search:{height:48,flex:1,color:theme.ink},chips:{gap:8},
 chip:{backgroundColor:"white",borderColor:theme.border,borderWidth:1,borderRadius:22,paddingVertical:9,paddingHorizontal:13},
 chipOn:{backgroundColor:theme.brandSoft,borderColor:"#B8DFC6"},chipText:{fontSize:12,fontWeight:"800",color:theme.brand},
 list:{gap:12},empty:{padding:65,alignItems:"center",gap:14},error:{color:theme.danger}
});
