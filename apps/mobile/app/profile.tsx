import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {direction,t,type Locale} from "@dineflow/shared";
import {authenticatedFetch,fetchIdentity} from "../src/api";
import {useLocale} from "../src/locale";
import {theme} from "../src/theme";
import {authClient} from "../src/auth-client";
import {ma} from "../src/auth-copy";
import {m26} from "../src/mobile26-copy";
import {useLiveScreen} from "../src/use-live-screen";
import {FloorRequestError} from "../src/floor-api";
import {LiveNotice,LoadingPanel} from "../src/mobile23-ui";
import appConfig from "../app.json";

export default function Profile(){
 const {locale,changeLocale}=useLocale(),rtl=direction(locale)==="rtl",insets=useSafeAreaInsets();
 const loader=useCallback(async()=>{
  try{return await fetchIdentity();}
  catch(err){
   if(String(err).includes("401"))throw new FloorRequestError(401,"UNAUTHENTICATED","Sign in again.");
   throw err;
  }
 },[]);
 const {data:identity,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen("waiter-profile",loader,30000);
 const [name,setName]=useState(""),[edited,setEdited]=useState(false);
 const [busy,setBusy]=useState(""),[actionError,setActionError]=useState(""),[success,setSuccess]=useState("");
 const lock=useRef(false);
 useEffect(()=>{if(identity&&!edited)setName(identity.user.name);},[identity?.user.name,edited]);
 async function updateLocale(value:Locale){
  if(lock.current||value===locale)return;
  lock.current=true;setBusy("locale");setActionError("");setSuccess("");
  try{
   await authenticatedFetch("/api/preferences/locale",{method:"PUT",body:JSON.stringify({locale:value})});
   changeLocale(value);
  }catch{setActionError(ma(locale,"error"));}
  finally{setBusy("");lock.current=false;}
 }
 async function saveName(){
  if(lock.current||!identity)return;
  const cleaned=name.trim();
  if(cleaned.length<2||cleaned.length>80){setActionError(ma(locale,"invalidName"));return;}
  if(cleaned===identity.user.name){setEdited(false);return;}
  lock.current=true;setBusy("name");setActionError("");setSuccess("");
  try{
   const result=await authClient.updateUser({name:cleaned});
   if(result.error)throw new Error("PROFILE_FAILED");
   setSuccess(m26(locale,"profileUpdated"));setEdited(false);setName(cleaned);
   await refresh(true);
  }catch{setActionError(ma(locale,"error"));}
  finally{lock.current=false;setBusy("");}
 }
 return <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled"
  contentContainerStyle={[styles.root,{paddingTop:insets.top+12,paddingBottom:insets.bottom+72}]}
  refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.brand} onRefresh={()=>void refresh(true)}/>}>
  <View style={[styles.header,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Pressable onPress={()=>router.back()} accessibilityRole="button"
    accessibilityLabel={ma(locale,"profile")} style={styles.back}>
    <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={23} color={theme.brand}/>
   </Pressable>
   <View style={{flex:1,gap:4}}>
    <Text style={[styles.caption,{textAlign:rtl?"right":"left"}]}>DINEFLOW / ACCOUNT</Text>
    <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{t(locale,"profile")}</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel={m26(locale,"refreshProfile")}
    disabled={refreshing} onPress={()=>void refresh(true)} style={styles.back}>
    {refreshing?<ActivityIndicator color={theme.brand}/>:<Ionicons name="refresh-outline" color={theme.brand} size={22}/>}
   </Pressable>
  </View>
  <LiveNotice locale={locale} error={error?m26(locale,"noIdentity"):""}
   lastUpdated={lastUpdated} hasData={!!identity} onRetry={()=>void refresh(true)}/>
  {!identity?(loading?<LoadingPanel locale={locale}/>:
   <View style={styles.card}><Text style={styles.hint}>{m26(locale,"noIdentity")}</Text>
    <Pressable accessibilityRole="button" style={styles.primary} onPress={()=>void refresh(true)}>
     <Text style={styles.primaryText}>{m26(locale,"retryConnection")}</Text>
    </Pressable>
   </View>):<>
   <View style={styles.identityCard}>
    <View style={[styles.identityHead,{flexDirection:rtl?"row-reverse":"row"}]}>
     <View style={styles.avatar}><Ionicons name="person-outline" size={28} color={theme.brand}/></View>
     <View style={{flex:1,minWidth:0,gap:5}}>
      <Text style={[styles.identityName,{textAlign:rtl?"right":"left"}]}>{identity.user.name}</Text>
      <Text style={[styles.email,{textAlign:rtl?"right":"left"}]}>{identity.user.email}</Text>
     </View>
    </View>
    <View style={styles.rule}/>
    <View style={[styles.metaRow,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name="storefront-outline" size={19} color={theme.brand}/>
     <View style={{flex:1,minWidth:0}}>
      <Text style={[styles.metaLabel,{textAlign:rtl?"right":"left"}]}>{m26(locale,"currentRestaurant")}</Text>
      <Text style={[styles.metaValue,{textAlign:rtl?"right":"left"}]}>
       {identity.tenantName??"—"}</Text>
     </View>
    </View>
    <View style={[styles.metaRow,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name="shield-checkmark-outline" size={19} color={theme.brand}/>
     <View style={{flex:1}}>
      <Text style={[styles.metaLabel,{textAlign:rtl?"right":"left"}]}>{m26(locale,"role")}</Text>
      <Text style={[styles.metaValue,{textAlign:rtl?"right":"left"}]}>{m26(locale,"waiterRole")}</Text>
     </View>
    </View>
   </View>
   <View style={styles.card}>
    <Text style={[styles.section,{textAlign:rtl?"right":"left"}]}>{ma(locale,"profile")}</Text>
    <Text style={[styles.label,{textAlign:rtl?"right":"left"}]}>{ma(locale,"name")}</Text>
    <TextInput value={name} maxLength={80} autoCapitalize="words" autoComplete="name"
     editable={!busy} onChangeText={value=>{setName(value);setEdited(true);setSuccess("");}}
     accessibilityLabel={ma(locale,"name")} style={[styles.input,{textAlign:rtl?"right":"left"}]}/>
    <Text style={[styles.label,{textAlign:rtl?"right":"left"}]}>{ma(locale,"email")}</Text>
    <View style={styles.readOnly}><Text selectable style={styles.readOnlyText}>{identity.user.email}</Text>
     <Ionicons name="lock-closed-outline" size={18} color={theme.muted}/></View>
    <Text style={[styles.hint,{textAlign:rtl?"right":"left"}]}>{m26(locale,"emailReadOnly")}</Text>
    <Pressable accessibilityRole="button" disabled={!!busy||!edited||name.trim()===identity.user.name}
     onPress={()=>void saveName()}
     style={[styles.primary,(!!busy||!edited||name.trim()===identity.user.name)&&styles.disabled]}>
     {busy==="name"?<ActivityIndicator color="white"/>:
      <Text style={styles.primaryText}>{ma(locale,"save")}</Text>}
    </Pressable>
   </View>
   <View style={styles.card}>
    <View style={[styles.sectionRow,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name="language-outline" size={22} color={theme.brand}/>
     <Text style={styles.section}>{t(locale,"language")}</Text>
    </View>
    {(["fa-AF","ps-AF","en"] as const).map(value=>
     <Pressable key={value} disabled={!!busy} accessibilityRole="radio"
      accessibilityState={{checked:locale===value}} onPress={()=>void updateLocale(value)}
      style={[styles.localeRow,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Text style={styles.localeLabel}>{value==="fa-AF"?"دری":value==="ps-AF"?"پښتو":"English"}</Text>
      <Ionicons name={locale===value?"radio-button-on":"radio-button-off"}
       color={locale===value?theme.brand:theme.muted} size={23}/>
     </Pressable>)}
   </View>
   <Pressable accessibilityRole="button" style={[styles.securityLink,{flexDirection:rtl?"row-reverse":"row"}]}
    onPress={()=>router.push("/security")}>
    <View style={styles.securityIcon}><Ionicons name="shield-checkmark-outline" size={23} color={theme.brand}/></View>
    <View style={{flex:1,gap:5}}>
     <Text style={[styles.section,{textAlign:rtl?"right":"left"}]}>{ma(locale,"security")}</Text>
     <Text style={[styles.hint,{textAlign:rtl?"right":"left"}]}>{m26(locale,"securityDescription")}</Text>
    </View>
    <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={21} color={theme.muted}/>
   </Pressable>
  </>}
  {!!actionError&&<Text accessibilityRole="alert" style={styles.error}>{actionError}</Text>}
  {!!success&&<Text accessibilityRole="alert" style={styles.success}>{success}</Text>}
  <Text style={styles.version}>DINEFLOW WAITER · v{appConfig.expo.version}</Text>
 </ScrollView>;
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:theme.background},
 root:{paddingHorizontal:17,gap:15,flexGrow:1},
 header:{alignItems:"center",gap:12},
 back:{width:45,height:45,borderRadius:14,backgroundColor:theme.brandSoft,
  alignItems:"center",justifyContent:"center"},
 caption:{fontSize:10,fontWeight:"900",color:theme.brand,letterSpacing:1},
 title:{fontSize:26,color:theme.ink,fontWeight:"900"},
 identityCard:{backgroundColor:"#fff",borderRadius:18,padding:18,borderWidth:1,borderColor:theme.border,gap:13},
 identityHead:{alignItems:"center",gap:13},
 avatar:{width:60,height:60,backgroundColor:theme.brandSoft,borderRadius:19,
  alignItems:"center",justifyContent:"center"},
 identityName:{fontSize:19,color:theme.ink,fontWeight:"900"},
 email:{fontSize:12,color:theme.muted,writingDirection:"ltr"},
 rule:{height:1,backgroundColor:theme.border},
 metaRow:{alignItems:"center",gap:10},
 metaLabel:{fontSize:11,color:theme.muted},
 metaValue:{fontSize:14,color:theme.ink,fontWeight:"800",marginTop:3},
 card:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,borderRadius:17,padding:18,gap:12},
 section:{fontSize:17,fontWeight:"800",color:theme.ink},
 sectionRow:{alignItems:"center",gap:10},
 label:{color:theme.ink,fontSize:13,fontWeight:"700"},
 input:{minHeight:49,borderWidth:1,borderColor:theme.border,borderRadius:12,
  paddingHorizontal:13,color:theme.ink,backgroundColor:"#fff",fontSize:16},
 readOnly:{minHeight:48,padding:13,borderRadius:11,backgroundColor:"#F3F7F4",
  flexDirection:"row",alignItems:"center",gap:8},
 readOnlyText:{flex:1,fontSize:14,color:theme.muted,writingDirection:"ltr"},
 hint:{fontSize:12,lineHeight:19,color:theme.muted},
 primary:{backgroundColor:theme.brand,borderRadius:12,minHeight:49,alignItems:"center",justifyContent:"center"},
 primaryText:{color:"#fff",fontSize:14,fontWeight:"800"},
 disabled:{opacity:.5},
 localeRow:{minHeight:51,paddingHorizontal:5,borderBottomWidth:1,borderBottomColor:theme.border,
  alignItems:"center",justifyContent:"space-between"},
 localeLabel:{fontSize:15,fontWeight:"700",color:theme.ink},
 securityLink:{backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,
  borderRadius:17,padding:17,minHeight:84,gap:12,alignItems:"center"},
 securityIcon:{width:45,height:45,backgroundColor:theme.brandSoft,borderRadius:13,
  justifyContent:"center",alignItems:"center"},
 error:{color:theme.danger,fontWeight:"700",fontSize:13},
 success:{color:theme.brand,fontWeight:"700",fontSize:13},
 version:{textAlign:"center",color:theme.muted,fontSize:10,letterSpacing:1,marginTop:2}
});
