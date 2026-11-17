import {useCallback,useEffect,useRef,useState} from "react";
import {Alert,Pressable,RefreshControl,ScrollView,StyleSheet,Switch,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import * as SecureStore from "expo-secure-store";
import {direction,t} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {authClient} from "../../src/auth-client";
import {theme} from "../../src/theme";
import {floorRequest,FloorRequestError} from "../../src/floor-api";
import {o5} from "../../src/order-copy";
import {vibrationKeyFor} from "../../src/mobile26-data";
import {m26} from "../../src/mobile26-copy";
import {fetchIdentity,type Identity} from "../../src/api";
import {m23} from "../../src/mobile23-copy";
import {ScreenHeader,LiveNotice,LoadingPanel,QuickLink,SectionHeading} from "../../src/mobile23-ui";
import {useLiveScreen} from "../../src/use-live-screen";
type MoreData={identity:Identity;unread:number|null;vibrate:boolean};
async function loadMore():Promise<MoreData>{
 let identity:Identity;
 try{identity=await fetchIdentity();}
 catch(e){if(String(e).includes("401"))throw new FloorRequestError(401,"UNAUTHENTICATED","Session ended");throw e;}
 const [alerts,preference]=await Promise.allSettled([
  floorRequest<{unread:number}>("/api/orders/notifications?page=1&unread=1"),
  SecureStore.getItemAsync(vibrationKeyFor(identity.user.id,identity.tenantId)??"dineflow.no-account")
 ]);
 return {identity,unread:alerts.status==="fulfilled"?alerts.value.unread:null,
  vibrate:preference.status==="fulfilled"?preference.value==="1":false};
}
export default function More(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [vibrate,setVibrate]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false),[errorAction,setErrorAction]=useState("");
 const locked=useRef(false),loader=useCallback(loadMore,[]);
 const {data,loading,refreshing,error,lastUpdated,refresh}=useLiveScreen("waiter-more",loader,30000);
 useEffect(()=>{if(data&&vibrate===null)setVibrate(data.vibrate);},[data,vibrate]);
 async function toggleVibration(next:boolean){
  if(locked.current||!data)return;
  locked.current=true;const old=vibrate;setVibrate(next);setErrorAction("");
  try{
   const key=data?vibrationKeyFor(data.identity.user.id,data.identity.tenantId):null;
   if(!key)throw new Error("ACCOUNT_UNAVAILABLE");
   await SecureStore.setItemAsync(key,next?"1":"0");
  }
  catch{setVibrate(old);setErrorAction(m23(locale,"noConnection"));}
  finally{locked.current=false;}
 }
 async function signOut(){
  if(busy)return;setBusy(true);setErrorAction("");
  try{
   const result=await authClient.signOut();
   if(result.error)throw new Error("SIGNOUT_FAILED");
   router.replace("/sign-in");
  }catch{setErrorAction(m23(locale,"noConnection"));}
  finally{setBusy(false);}
 }
 function confirmSignOut(){
  Alert.alert(m23(locale,"signoutTitle"),m23(locale,"signoutBody"),[
   {text:m23(locale,"cancel"),style:"cancel"},
   {text:m23(locale,"signout"),style:"destructive",onPress:()=>void signOut()}
  ]);
 }
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh(true)} tintColor={theme.brand}/>}>
  <ScreenHeader locale={locale} title={t(locale,"more")} caption="DINEFLOW / ACCOUNT"
   subtitle={m23(locale,"accountHint")} onRefresh={()=>void refresh(true)} refreshing={refreshing}/>
  <LiveNotice locale={locale} error={error||errorAction}
   lastUpdated={lastUpdated} hasData={!!data} onRetry={()=>void refresh(true)}/>
  {loading&&!data?<LoadingPanel locale={locale}/>:
   <><View style={styles.profileCard}>
     <View style={[styles.profileTop,{flexDirection:rtl?"row-reverse":"row"}]}>
      <View style={styles.avatar}><Ionicons name="person-outline" size={28} color={theme.brand}/></View>
      <View style={styles.profileText}>
       <Text style={[styles.profileName,{textAlign:rtl?"right":"left"}]}>
        {data?.identity.user.name??m23(locale,"account")}</Text>
       <Text style={[styles.profileEmail,{textAlign:rtl?"right":"left"}]}>
        {data?.identity.user.email??m23(locale,"unknown")}</Text>
       <View style={[styles.roleTag,{flexDirection:rtl?"row-reverse":"row"}]}>
        <Ionicons name="shield-checkmark-outline" size={13} color={theme.brand}/>
        <Text style={styles.roleText}>{m23(locale,"workspace")}</Text>
       </View>
      </View>
     </View>
     <View style={styles.restaurantDivider}/>
     <View style={[styles.tenantRow,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Ionicons name="storefront-outline" size={18} color={theme.brand}/>
      <View style={styles.tenantInfo}>
       <Text style={[styles.tenantLabel,{textAlign:rtl?"right":"left"}]}>{m23(locale,"currentRestaurant")}</Text>
       <Text style={[styles.tenantName,{textAlign:rtl?"right":"left"}]}>{data?.identity.tenantName??m23(locale,"unknown")}</Text>
      </View>
     </View>
    </View>
    <SectionHeading locale={locale} title={m23(locale,"service")} icon="flash-outline"/>
    <View style={styles.links}>
     <QuickLink locale={locale} icon="notifications-outline" label={m23(locale,"notifications")}
      description={m23(locale,"notificationsHint")} badge={data?.unread}
      onPress={()=>router.push("/notifications")}/>
     <QuickLink locale={locale} icon="hand-left-outline" label={m23(locale,"goRequests")}
      description={m23(locale,"serviceHint")} onPress={()=>router.push("/requests")}/>
     <QuickLink locale={locale} icon="people-outline" label={m23(locale,"goApprovals")}
      description={m23(locale,"approvalsHint")} onPress={()=>router.push("/approvals")}/>
    </View>
    <SectionHeading locale={locale} title={m23(locale,"settings")} icon="settings-outline"/>
    <View style={styles.links}>
     <QuickLink locale={locale} icon="person-circle-outline" label={t(locale,"profile")+" · "+m23(locale,"language")}
      description={m23(locale,"accountHint")} onPress={()=>router.push("/profile")}/>
     <QuickLink locale={locale} icon="shield-checkmark-outline" label={m23(locale,"security")}
      description={m23(locale,"securityHint")} onPress={()=>router.push("/security")}/>
    </View>
    <View style={styles.vibrationCard}>
     <SectionHeading locale={locale} title={m23(locale,"vibration")} icon="notifications-outline"/>
     <Text style={[styles.settingDescription,{textAlign:rtl?"right":"left"}]}>{m26(locale,"vibrationHelp")}</Text>
     <View style={[styles.toggleRow,{flexDirection:rtl?"row-reverse":"row"}]}>
      <View style={styles.toggleText}>
       <Text style={[styles.toggleTitle,{textAlign:rtl?"right":"left"}]}>
        {m23(locale,(vibrate??data?.vibrate)?"vibrationOn":"vibrationOff")}</Text>
       <Text style={[styles.toggleHint,{textAlign:rtl?"right":"left"}]}>{o5(locale,"readyInstructions")}</Text>
      </View>
      <Switch disabled={!data} value={vibrate??data?.vibrate??false}
       onValueChange={value=>void toggleVibration(value)}
       trackColor={{false:"#C4D6CB",true:"#9AD5B6"}} thumbColor={vibrate??data?.vibrate?"#247B57":"#F7FAF7"}
       accessibilityLabel={m23(locale,"vibration")}/>
     </View>
    </View>
    <View style={styles.helpCard}>
     <SectionHeading locale={locale} title={m26(locale,"helpTitle")} icon="help-circle-outline"/>
     <Text style={[styles.settingDescription,{textAlign:rtl?"right":"left"}]}>{m26(locale,"helpText")}</Text>
     <View style={[styles.helpHint,{flexDirection:rtl?"row-reverse":"row"}]}>
      <Ionicons name="shield-checkmark-outline" size={16} color={theme.brand}/>
      <Text style={[styles.settingDescription,{flex:1,textAlign:rtl?"right":"left"}]}>{m26(locale,"offlineChanges")}</Text>
     </View>
    </View>
    <Pressable onPress={confirmSignOut} disabled={busy} accessibilityRole="button"
     style={[styles.signOut,{flexDirection:rtl?"row-reverse":"row"},busy&&styles.disabled]}>
     <Ionicons name="log-out-outline" size={22} color={theme.danger}/>
     <Text style={styles.signOutText}>{m23(locale,"signout")}</Text>
     <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={18} color={theme.danger}/>
    </Pressable>
    <View style={[styles.secureFooter,{flexDirection:rtl?"row-reverse":"row"}]}>
     <Ionicons name="shield-checkmark-outline" size={18} color={theme.brand}/>
     <Text style={[styles.secureText,{textAlign:rtl?"right":"left"}]}>{m23(locale,"secureHint")}</Text>
    </View>
   </>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:theme.background},
 content:{paddingHorizontal:17,paddingBottom:35,gap:16},
 profileCard:{padding:19,borderRadius:18,backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,gap:15},
 profileTop:{alignItems:"center",gap:14},
 avatar:{height:59,width:59,borderRadius:19,alignItems:"center",justifyContent:"center",
  backgroundColor:theme.brandSoft,borderWidth:1,borderColor:"#D2E9D9"},
 profileText:{flex:1,minWidth:0,gap:5},
 profileName:{fontSize:19,fontWeight:"900",color:theme.ink},
 profileEmail:{fontSize:12,color:theme.muted,writingDirection:"ltr"},
 roleTag:{alignSelf:"flex-start",alignItems:"center",gap:6,paddingVertical:5,
  paddingHorizontal:9,borderRadius:99,backgroundColor:theme.brandSoft,marginTop:4},
 roleText:{fontSize:10,color:theme.brand,fontWeight:"800"},
 restaurantDivider:{height:1,backgroundColor:theme.border},
 tenantRow:{alignItems:"center",gap:10},
 tenantInfo:{flex:1,gap:4},
 tenantLabel:{fontSize:11,color:theme.muted,fontWeight:"600"},
 tenantName:{fontSize:14,fontWeight:"800",color:theme.ink},
 links:{gap:8},
 vibrationCard:{padding:18,backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:theme.border,gap:14},
 helpCard:{padding:18,backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:theme.border,gap:13},
 helpHint:{alignItems:"flex-start",gap:8,padding:12,backgroundColor:theme.brandSoft,borderRadius:11},
 settingDescription:{color:theme.muted,fontSize:12,lineHeight:20},
 toggleRow:{alignItems:"center",gap:14,padding:12,backgroundColor:theme.brandSoft,borderRadius:12},
 toggleText:{flex:1,gap:5},
 toggleTitle:{color:theme.brand,fontSize:13,fontWeight:"800"},
 toggleHint:{color:theme.muted,fontSize:11,lineHeight:17},
 signOut:{backgroundColor:"#FFF7F5",padding:17,borderWidth:1,borderColor:"#F0D3CE",
  borderRadius:14,alignItems:"center",gap:12,minHeight:54},
 signOutText:{fontSize:14,fontWeight:"800",color:theme.danger,flex:1},
 secureFooter:{gap:9,alignItems:"center",paddingHorizontal:8},
 secureText:{color:theme.brand,fontSize:11,lineHeight:18,flex:1},
 disabled:{opacity:.45}
});
