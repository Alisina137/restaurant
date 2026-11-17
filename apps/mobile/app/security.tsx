import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import {direction} from "@dineflow/shared";
import {authClient} from "../src/auth-client";
import {useLocale} from "../src/locale";
import {ma} from "../src/auth-copy";
import {theme} from "../src/theme";

type SessionInfo={token:string;userAgent?:string|null;updatedAt:string|Date;expiresAt:string|Date};
function formatDate(value:Date|string,locale:string){
 const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString(locale);
}
export default function Security(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [oldPassword,setOldPassword]=useState(""),[newPassword,setNewPassword]=useState("");
 const [confirmPassword,setConfirmPassword]=useState(""),[visible,setVisible]=useState(false);
 const [busy,setBusy]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [loading,setLoading]=useState(true),[sessions,setSessions]=useState<SessionInfo[]>([]);
 const [currentToken,setCurrentToken]=useState("");
 const lock=useRef(false);
 async function refresh(){
  setLoading(true);
  try{
   const [list,active]=await Promise.all([authClient.listSessions(),authClient.getSession()]);
   if(list.error||active.error)throw new Error("SESSIONS_FAILED");
   setSessions((list.data??[]) as SessionInfo[]);
   setCurrentToken(active.data?.session.token??"");
  }catch{setError(ma(locale,"loadFailed"));}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 function begin(action:string){
  if(lock.current)return false;
  lock.current=true;setBusy(action);setMessage("");setError("");return true;
 }
 function finish(){lock.current=false;setBusy("");}
 async function changePassword(){
  if(!oldPassword||newPassword.length<12||newPassword.length>128)return;
  if(newPassword!==confirmPassword){setError(ma(locale,"mismatch"));return;}
  if(oldPassword===newPassword){setError(ma(locale,"passwordRule"));return;}
  if(!begin("password"))return;
  try{
   const result=await authClient.changePassword({
     currentPassword:oldPassword,newPassword,revokeOtherSessions:true
   });
   if(result.error)throw new Error("PASSWORD_FAILED");
   setOldPassword("");setNewPassword("");setConfirmPassword("");
   setMessage(ma(locale,"changed"));await refresh();
  }catch{setError(ma(locale,"error"));}
  finally{finish();}
 }
 async function revokeOther(){
  if(!begin("sessions"))return;
  try{
   const result=await authClient.revokeOtherSessions();
   if(result.error)throw new Error("REVOKE_FAILED");
   setMessage(ma(locale,"sessionRemoved"));await refresh();
  }catch{setError(ma(locale,"error"));}
  finally{finish();}
 }
 async function revokeOne(token:string){
  if(token===currentToken||!begin("sessions"))return;
  try{
   const result=await authClient.revokeSession({token});
   if(result.error)throw new Error("REVOKE_FAILED");
   setMessage(ma(locale,"sessionRemoved"));await refresh();
  }catch{setError(ma(locale,"error"));}
  finally{finish();}
 }
 function ask(action:()=>void,title:string){
  Alert.alert(title,ma(locale,"confirm"),[
   {text:ma(locale,"cancel"),style:"cancel"},
   {text:ma(locale,"one"),style:"destructive",onPress:action}
  ]);
 }
 const disableChange=!!busy||!oldPassword||newPassword.length<12||newPassword.length>128||
  newPassword!==confirmPassword;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.root}>
  <Pressable accessibilityRole="button" onPress={()=>router.back()} style={[styles.back,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={22} color={theme.brand}/>
   <Text style={styles.backText}>{ma(locale,"profile")}</Text>
  </Pressable>
  <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{ma(locale,"security")}</Text>
  <Text style={[styles.hint,{textAlign:rtl?"right":"left"}]}>{ma(locale,"securityHint")}</Text>
  <View style={styles.card}>
   <View style={[styles.heading,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Ionicons name="key-outline" size={22} color={theme.brand}/>
    <Text style={styles.section}>{ma(locale,"change")}</Text>
   </View>
   <Text style={styles.hint}>{ma(locale,"passwordRule")}</Text>
   <Text style={[styles.label,{textAlign:rtl?"right":"left"}]}>{ma(locale,"oldPassword")}</Text>
   <TextInput style={styles.input} value={oldPassword} onChangeText={setOldPassword}
     secureTextEntry={!visible} autoComplete="current-password" accessibilityLabel={ma(locale,"oldPassword")}/>
   <Text style={[styles.label,{textAlign:rtl?"right":"left"}]}>{ma(locale,"newPassword")}</Text>
   <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword}
     secureTextEntry={!visible} autoComplete="new-password" maxLength={128} accessibilityLabel={ma(locale,"newPassword")}/>
   <Text style={[styles.label,{textAlign:rtl?"right":"left"}]}>{ma(locale,"repeatPassword")}</Text>
   <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
     secureTextEntry={!visible} autoComplete="new-password" maxLength={128} accessibilityLabel={ma(locale,"repeatPassword")}/>
   <Pressable accessibilityRole="button" accessibilityLabel={ma(locale,visible?"hide":"show")}
     style={styles.toggle} onPress={()=>setVisible(x=>!x)}>
    <Ionicons name={visible?"eye-off-outline":"eye-outline"} size={20} color={theme.brand}/>
    <Text style={styles.toggleText}>{ma(locale,visible?"hide":"show")}</Text>
   </Pressable>
   <Pressable accessibilityRole="button" onPress={()=>void changePassword()} disabled={disableChange}
     style={[styles.primary,disableChange&&styles.disabled]}>
    {busy==="password"?<ActivityIndicator color="#fff"/>:<Text style={styles.primaryText}>{ma(locale,"change")}</Text>}
   </Pressable>
  </View>
  <View style={styles.card}>
   <View style={[styles.heading,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Ionicons name="shield-checkmark-outline" size={23} color={theme.brand}/>
    <Text style={styles.section}>{ma(locale,"sessions")}</Text>
   </View>
   <View style={styles.actionRow}>
    <Pressable accessibilityRole="button" disabled={loading||!!busy} onPress={()=>void refresh()} style={styles.smallButton}>
     <Ionicons name="refresh-outline" size={18} color={theme.brand}/><Text style={styles.smallText}>{ma(locale,"loading")}</Text>
    </Pressable>
    <Pressable accessibilityRole="button"
     disabled={!!busy||loading||!sessions.some(s=>s.token!==currentToken)}
     onPress={()=>ask(()=>{void revokeOther();},ma(locale,"others"))} style={styles.smallButton}>
     <Text style={styles.dangerText}>{ma(locale,"others")}</Text>
    </Pressable>
   </View>
   {loading?<ActivityIndicator color={theme.brand}/>:
    sessions.length===0?<Text style={styles.hint}>{ma(locale,"noSessions")}</Text>:
    sessions.map(item=><View key={item.token} style={styles.session}>
     <Ionicons name="phone-portrait-outline" size={20} color={theme.brand}/>
     <View style={styles.sessionBody}>
      <Text style={styles.sessionTitle}>{ma(locale,item.token===currentToken?"current":"other")}</Text>
      <Text style={styles.sessionDetail}>{(item.userAgent||ma(locale,"other")).slice(0,110)}</Text>
      <Text style={styles.sessionDetail}>{formatDate(item.updatedAt,locale)}</Text>
     </View>
     {item.token===currentToken?<Ionicons name="checkmark-circle-outline" size={20} color={theme.brand}/>:
      <Pressable accessibilityRole="button" disabled={!!busy}
       onPress={()=>ask(()=>{void revokeOne(item.token);},ma(locale,"one"))} style={styles.sessionAction}>
       <Text style={styles.dangerText}>{ma(locale,"one")}</Text>
      </Pressable>}
    </View>)}
  </View>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!message&&<Text accessibilityRole="alert" style={styles.success}>{message}</Text>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flexGrow:1,paddingTop:60,paddingHorizontal:19,paddingBottom:82,gap:14,backgroundColor:theme.background},
 back:{alignItems:"center",gap:8,minHeight:44},backText:{color:theme.brand,fontSize:14,fontWeight:"700"},
 title:{fontSize:27,fontWeight:"800",color:theme.ink},
 hint:{color:theme.muted,fontSize:13,lineHeight:21},
 card:{backgroundColor:"#fff",borderRadius:theme.radius,borderWidth:1,borderColor:theme.border,padding:19,gap:11},
 heading:{alignItems:"center",gap:11},section:{fontSize:18,fontWeight:"800",color:theme.ink},
 label:{fontSize:13,fontWeight:"700",color:theme.ink},
 input:{minHeight:48,borderRadius:12,borderWidth:1,borderColor:theme.border,paddingHorizontal:13,color:theme.ink,fontSize:15},
 toggle:{flexDirection:"row",alignItems:"center",gap:9,alignSelf:"flex-end",minHeight:40},
 toggleText:{fontSize:13,color:theme.brand,fontWeight:"700"},
 primary:{backgroundColor:theme.brand,borderRadius:12,minHeight:49,justifyContent:"center",alignItems:"center"},
 primaryText:{color:"#fff",fontSize:15,fontWeight:"800"},
 disabled:{opacity:.55},
 actionRow:{flexDirection:"row",gap:8,flexWrap:"wrap"},
 smallButton:{flexDirection:"row",gap:6,alignItems:"center",padding:11,borderRadius:11,
  borderColor:theme.border,borderWidth:1,backgroundColor:"#F6FAF7"},
 smallText:{fontSize:12,fontWeight:"700",color:theme.brand},
 dangerText:{fontSize:12,fontWeight:"800",color:theme.danger},
 session:{flexDirection:"row",alignItems:"flex-start",gap:10,paddingVertical:12,borderTopWidth:1,borderTopColor:theme.border},
 sessionBody:{flex:1,gap:4,minWidth:0},
 sessionTitle:{fontSize:14,color:theme.ink,fontWeight:"800"},
 sessionDetail:{fontSize:11,color:theme.muted,lineHeight:18},
 sessionAction:{padding:8},
 error:{fontSize:13,color:theme.danger,lineHeight:20},
 success:{fontSize:13,color:theme.brand,fontWeight:"700",lineHeight:20}
});
