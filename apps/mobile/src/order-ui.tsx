import {useEffect,useState} from "react";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Image,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {direction,type Locale} from "@dineflow/shared";
import {authClient,API_URL} from "./auth-client";
import {theme} from "./theme";
import {nameOf,price,type MenuData,type MenuItem,type CartLine} from "./order-types";
import {o5} from "./order-copy";
import {m25} from "./mobile25-copy";
import {toggleOption,validOptions} from "./mobile25-cart";

export function useMenuCookie(){const [cookie,setCookie]=useState("");
 useEffect(()=>{void authClient.getCookie().then(v=>setCookie(v??""));},[]);
 return cookie;
}
export function MenuCard({item,locale,cookie,onPress,readOnly=false}:{
 item:MenuItem;locale:Locale;cookie:string;onPress:()=>void;readOnly?:boolean;
}){
 const rtl=direction(locale)==="rtl";
 return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card,{flexDirection:rtl?"row-reverse":"row"}]}>
   <View style={styles.photo}>
    {item.imageId&&cookie?<Image style={styles.image} source={{uri:API_URL+"/api/menu/images/"+item.imageId,
      headers:{Cookie:cookie}}}/>:<Ionicons name="fast-food-outline" size={29} color={theme.brand}/>}</View>
   <View style={styles.cardInfo}>
    <Text numberOfLines={2} style={[styles.cardTitle,{textAlign:rtl?"right":"left"}]}>{nameOf(item,locale)}</Text>
    <Text numberOfLines={2} style={[styles.desc,{textAlign:rtl?"right":"left"}]}>{item.description||" "}</Text>
    <View style={[styles.bottom,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Text style={styles.price}>{price(item.priceMinor,locale)}</Text>
      {item.soldOut?<Text style={styles.sold}>{o5(locale,"soldOut")}</Text>:
      <View style={styles.addIcon}><Ionicons name={readOnly?"eye-outline":"add"} size={18} color={theme.brand}/></View>}
    </View>
   </View>
 </Pressable>;
}
export function ItemOptionsModal({item,menu,locale,cookie,visible,onClose,onAdd,initial}:{
 item:MenuItem|null;menu:MenuData;locale:Locale;cookie:string;visible:boolean;onClose:()=>void;
 onAdd:(line:CartLine)=>void;initial?:CartLine;
}){
 const rtl=direction(locale)==="rtl",safe=useSafeAreaInsets();
 const [qty,setQty]=useState(1),[note,setNote]=useState(""),[selected,setSelected]=useState<Record<string,string[]>>({}),[error,setError]=useState("");
 useEffect(()=>{
  if(!item)return;
  setQty(initial?.quantity??1);setNote(initial?.note??"");setError("");
  setSelected(Object.fromEntries(initial?.selections.map(x=>[x.groupId,x.optionIds])??[]));
 },[item,initial]);
 if(!item)return null;
 const groups=item.groupIds.map(id=>menu.groups.find(g=>g.id===id)).filter((x):x is NonNullable<typeof x>=>!!x);
 const currentSelections=groups.map(g=>({groupId:g.id,version:g.version,optionIds:selected[g.id]??[]}));
 const extra=groups.reduce((sum,g)=>sum+(selected[g.id]??[]).reduce((n,id)=>n+(g.options.find(o=>o.id===id)?.deltaMinor??0),0),0);
 function toggle(groupId:string,id:string){
  const group=groups.find(g=>g.id===groupId);
  if(!group)return;
  const current=selected[groupId]??[];
  const next=toggleOption(group,current,id);
  if(next===current){setError(m25(locale,"requiredOptions"));return;}
  setSelected(old=>({...old,[groupId]:next}));
  setError("");
 }
 function add(){
  if(!item||item.soldOut){setError(o5(locale,"unavailable"));return;}
  if(groups.length!==item.groupIds.length){setError(m25(locale,"modifierChanged"));return;}
  if(note.length>250||!Number.isInteger(qty)||qty<1||qty>99){
   setError(m25(locale,"invalid"));return;
  }
  for(const group of groups){
   if(!validOptions(group,selected[group.id]??[])){
    setError(m25(locale,"invalidChoices"));return;
   }
  }
  onAdd({itemId:item.id,itemVersion:item.version,quantity:qty,note:note.trim(),selections:currentSelections});
  onClose();
 }
 return <Modal visible={visible} onRequestClose={onClose} transparent animationType="slide">
  <View style={styles.backdrop}><View style={styles.sheet}>
   <View style={[styles.head,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Text style={styles.sheetTitle}>{nameOf(item,locale)}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={o5(locale,"cancel")} onPress={onClose}
      style={styles.iconButton}><Ionicons name="close" size={22} color={theme.ink}/></Pressable></View>
   <ScrollView contentContainerStyle={styles.sheetContents} keyboardShouldPersistTaps="handled">
    {!!item.description&&<Text style={[styles.desc,{textAlign:rtl?"right":"left"}]}>{item.description}</Text>}
    {!!item.allergens.length&&<Text style={[styles.allergen,{textAlign:rtl?"right":"left"}]}>
      {o5(locale,"allergens")}: {item.allergens.join(", ")}</Text>}
    {groups.map(group=><View key={group.id} style={styles.group}>
     <View style={[styles.groupHead,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Text style={styles.groupTitle}>{nameOf(group,locale)}</Text>
      <Text style={styles.groupHint}>{group.minSelections>0?o5(locale,"required"):o5(locale,"optional")} · {group.minSelections}–{group.maxSelections} · {(selected[group.id]??[]).length} {m25(locale,"selected")}</Text></View>
     {group.options.map(option=><Pressable key={option.id} accessibilityRole={group.selectionMode==="single"?"radio":"checkbox"}
       accessibilityState={{checked:(selected[group.id]??[]).includes(option.id)}}
       onPress={()=>toggle(group.id,option.id)}
       style={[styles.choice,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Ionicons name={(selected[group.id]??[]).includes(option.id)?"checkmark-circle":"ellipse-outline"}
        size={23} color={(selected[group.id]??[]).includes(option.id)?theme.brand:theme.muted}/>
      <Text style={styles.choiceName}>{nameOf(option,locale)}</Text>
      <Text style={styles.choicePrice}>{option.deltaMinor?"+ "+price(option.deltaMinor,locale):"—"}</Text>
     </Pressable>)}
    </View>)}
    <View style={styles.group}>
     <Text style={[styles.groupTitle,{textAlign:rtl?"right":"left"}]}>{o5(locale,"note")}</Text>
     <TextInput multiline maxLength={250} value={note} onChangeText={setNote} placeholder={o5(locale,"specialInstructions")}
       placeholderTextColor={theme.muted} style={[styles.note,{textAlign:rtl?"right":"left"}]}/>
    </View>
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   </ScrollView>
   <View style={[styles.footer,{flexDirection:rtl?"row-reverse":"row",paddingBottom:Math.max(safe.bottom,10)+12}]}>
    <View style={styles.qty}><Pressable accessibilityRole="button" disabled={qty<=1} style={qty<=1&&styles.dimmed} onPress={()=>setQty(q=>Math.max(1,q-1))} accessibilityLabel={o5(locale,"decrease")}>
       <Ionicons name="remove-circle-outline" size={30} color={theme.brand}/></Pressable>
      <Text style={styles.qtyText}>{qty}</Text>
      <Pressable accessibilityRole="button" disabled={qty>=99} style={qty>=99&&styles.dimmed} onPress={()=>setQty(q=>Math.min(99,q+1))} accessibilityLabel={o5(locale,"increase")}>
       <Ionicons name="add-circle-outline" size={30} color={theme.brand}/></Pressable></View>
    <Pressable accessibilityRole="button" disabled={item.soldOut} style={[styles.addButton,item.soldOut&&{opacity:.5}]} onPress={add}>
      <Text style={styles.addText}>{o5(locale,"addToCart")} · {price((item.priceMinor+extra)*qty,locale)}</Text></Pressable>
   </View>
  </View></View>
 </Modal>;
}
const styles=StyleSheet.create({
 card:{borderRadius:17,borderWidth:1,borderColor:theme.border,padding:12,backgroundColor:theme.surface,gap:13,alignItems:"center"},
 photo:{width:82,height:82,borderRadius:13,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center",overflow:"hidden"},
 image:{width:"100%",height:"100%"},
 cardInfo:{flex:1,gap:5,minWidth:0},
 cardTitle:{color:theme.ink,fontSize:16,fontWeight:"800"},
 desc:{color:theme.muted,fontSize:12,lineHeight:19},
 bottom:{alignItems:"center",justifyContent:"space-between",gap:8,marginTop:6},
 price:{color:theme.brand,fontWeight:"800",fontSize:14},
 sold:{color:theme.danger,backgroundColor:"#FEEDEE",borderRadius:10,paddingHorizontal:7,paddingVertical:5,fontSize:11,fontWeight:"800"},
 addIcon:{backgroundColor:theme.brandSoft,borderRadius:10,width:29,height:29,alignItems:"center",justifyContent:"center"},
 backdrop:{flex:1,justifyContent:"flex-end",backgroundColor:"#08291E88"},
 sheet:{backgroundColor:theme.surface,borderTopLeftRadius:25,borderTopRightRadius:25,maxHeight:"91%",paddingTop:16},
 head:{alignItems:"center",justifyContent:"space-between",paddingHorizontal:22,paddingBottom:14,borderBottomWidth:1,borderBottomColor:theme.border},
 sheetTitle:{fontSize:19,fontWeight:"800",color:theme.ink,flex:1},
 iconButton:{padding:5},sheetContents:{paddingHorizontal:21,paddingVertical:18,gap:16},
 allergen:{fontSize:12,color:"#9B651F",backgroundColor:"#FFF6E6",borderRadius:10,padding:10},
 group:{gap:10,borderBottomWidth:1,borderBottomColor:theme.border,paddingBottom:13},
 groupHead:{alignItems:"center",justifyContent:"space-between",gap:9},
 groupTitle:{fontSize:16,fontWeight:"800",color:theme.ink},
 groupHint:{fontSize:12,color:theme.muted},choice:{alignItems:"center",gap:10,paddingVertical:10},
 choiceName:{fontSize:14,color:theme.ink,flex:1,fontWeight:"600"},
 choicePrice:{fontSize:12,fontWeight:"800",color:theme.brand},
 note:{minHeight:74,maxHeight:150,borderWidth:1,borderColor:theme.border,borderRadius:12,color:theme.ink,padding:12,textAlignVertical:"top"},
 error:{color:theme.danger,fontSize:13},
 footer:{borderTopWidth:1,borderTopColor:theme.border,alignItems:"center",gap:13,paddingHorizontal:17,paddingVertical:18},
 dimmed:{opacity:.4},
 qty:{flexDirection:"row",gap:9,alignItems:"center"},qtyText:{minWidth:21,textAlign:"center",fontSize:17,fontWeight:"800",color:theme.ink},
 addButton:{backgroundColor:theme.brand,flex:1,minHeight:49,borderRadius:13,alignItems:"center",justifyContent:"center",paddingHorizontal:10},
 addText:{fontSize:12,color:"white",fontWeight:"800",textAlign:"center"},
});
