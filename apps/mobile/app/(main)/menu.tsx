import {useCallback,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router,useFocusEffect} from "expo-router";
import {direction} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {floorRequest} from "../../src/floor-api";
import {type Board} from "../../src/floor";
import {o5} from "../../src/order-copy";
import {type MenuData,type MenuItem,nameOf} from "../../src/order-types";
import {MenuCard,ItemOptionsModal,useMenuCookie} from "../../src/order-ui";
export default function WaiterMenu(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl",cookie=useMenuCookie();
 const [data,setData]=useState<MenuData|null>(null),[board,setBoard]=useState<Board|null>(null),
   [search,setSearch]=useState(""),[category,setCategory]=useState(""),[item,setItem]=useState<MenuItem|null>(null),
   [showTables,setShowTables]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
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
     <Pressable key={t.id} onPress={()=>router.push({pathname:"/visit/[id]/new-order",params:{id:t.visitId!}})}
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
  {data&&<ItemOptionsModal key={item?.id} item={item} menu={data} locale={locale} cookie={cookie} visible={!!item}
    onClose={()=>setItem(null)} onAdd={()=>{setItem(null);setShowTables(true);}}/>}
 </ScrollView>;
}
const styles=StyleSheet.create({
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
