import {useRef,useState} from "react";
import {ActivityIndicator,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {router} from "expo-router";
import {direction,t} from "@dineflow/shared";
import {authClient} from "../src/auth-client";
import {useLocale} from "../src/locale";
import {ma,webCallback} from "../src/auth-copy";
import {theme} from "../src/theme";

export default function ForgotPassword(){
 const {locale}=useLocale(),rtl=direction(locale)==="rtl";
 const [email,setEmail]=useState(""),[busy,setBusy]=useState(false);
 const [done,setDone]=useState(false),[error,setError]=useState("");
 const submitting=useRef(false);
 async function submit(){
  if(submitting.current||!email.includes("@"))return;
  const callback=webCallback("/reset-password");
  if(!callback){setError(ma(locale,"unavailable"));return;}
  submitting.current=true;setBusy(true);setError("");
  try{
   const result=await authClient.requestPasswordReset({email:email.trim().toLowerCase(),redirectTo:callback});
   if(result.error)throw new Error("RESET_REQUEST_FAILED");
   setDone(true);
  }catch{setError(ma(locale,"retry"));}
  finally{submitting.current=false;setBusy(false);}
 }
 return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==="ios"?"padding":undefined}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.root}>
   <Pressable accessibilityRole="button" style={[styles.back,{flexDirection:rtl?"row-reverse":"row"}]}
     onPress={()=>router.replace("/sign-in")}>
    <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={21} color={theme.brand}/>
    <Text style={styles.backText}>{ma(locale,"back")}</Text>
   </Pressable>
   <View style={styles.card}>
    <View style={styles.icon}><Ionicons name={done?"checkmark-circle-outline":"mail-outline"} color={theme.brand} size={29}/></View>
    <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{done?ma(locale,"done"):ma(locale,"resetTitle")}</Text>
    <Text style={[styles.subtitle,{textAlign:rtl?"right":"left"}]}>{done?ma(locale,"done"):ma(locale,"resetHint")}</Text>
    {done?<><Text style={styles.email}>{email.toLowerCase().trim()}</Text>
     <Pressable accessibilityRole="button" style={styles.button} onPress={()=>router.replace("/sign-in")}>
      <Text style={styles.buttonText}>{ma(locale,"back")}</Text>
     </Pressable></>:<>
     <Text style={[styles.label,{textAlign:rtl?"right":"left"}]}>{ma(locale,"email")}</Text>
     <TextInput style={styles.input} keyboardType="email-address" textAlign="left" autoCapitalize="none"
       autoComplete="email" placeholder="staff@example.com" accessibilityLabel={ma(locale,"email")}
       value={email} onChangeText={setEmail} maxLength={254}/>
     {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
     <Pressable accessibilityRole="button" onPress={()=>void submit()} disabled={busy||!email.includes("@")}
       style={[styles.button,(busy||!email.includes("@"))&&styles.disabled]}>
      {busy?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>{ma(locale,"send")}</Text>}
     </Pressable>
    </>}
   </View>
   <Text style={styles.hint}>{t(locale,"secureBody")}</Text>
  </ScrollView>
 </KeyboardAvoidingView>;
}
const styles=StyleSheet.create({
 flex:{flex:1,backgroundColor:theme.background},
 root:{flexGrow:1,paddingTop:70,paddingHorizontal:20,paddingBottom:38,gap:24,backgroundColor:theme.background},
 back:{alignItems:"center",gap:10,minHeight:44},backText:{color:theme.brand,fontSize:15,fontWeight:"700"},
 card:{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:23,
  padding:24,gap:15,shadowColor:"#0E4037",shadowOpacity:.07,shadowRadius:18,elevation:3},
 icon:{width:58,height:58,borderRadius:17,backgroundColor:theme.brandSoft,justifyContent:"center",alignItems:"center"},
 title:{fontSize:25,fontWeight:"800",color:theme.ink,lineHeight:36},
 subtitle:{fontSize:14,lineHeight:24,color:theme.muted},
 label:{color:theme.ink,fontWeight:"700",fontSize:14,marginTop:8},
 input:{height:50,borderRadius:12,borderWidth:1,borderColor:theme.border,paddingHorizontal:14,
  backgroundColor:"#fff",color:theme.ink,fontSize:15},
 button:{minHeight:51,borderRadius:12,backgroundColor:theme.brand,justifyContent:"center",alignItems:"center",marginTop:8},
 buttonText:{color:"#fff",fontWeight:"800",fontSize:15},
 email:{fontSize:14,color:theme.brand,fontWeight:"700",textAlign:"left"},
 disabled:{opacity:.55},error:{color:theme.danger,fontSize:13,lineHeight:20},
 hint:{textAlign:"center",fontSize:13,color:theme.muted,lineHeight:20}
});
