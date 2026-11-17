import {useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {useLocale} from "./locale";
import {m26} from "./mobile26-copy";
import {probeConnection,useConnectionStatus} from "./network-status";
import {theme} from "./theme";
export function NetworkBanner(){
 const {locale}=useLocale(),status=useConnectionStatus(),[busy,setBusy]=useState(false);
 if(status==="unknown"||status==="connected")return null;
 async function check(){if(busy)return;setBusy(true);try{await probeConnection();}finally{setBusy(false);}}
 return <View accessibilityRole="alert" style={styles.banner}>
  <Ionicons name={status==="offline"?"cloud-offline-outline":"alert-circle-outline"} color={theme.danger} size={19}/>
  <Text style={styles.text}>{m26(locale,status==="offline"?"connectionLost":"serverUnavailable")}</Text>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void check()} style={styles.button}>
   <Text style={styles.link}>{busy?"…":m26(locale,"retryConnection")}</Text>
  </Pressable>
 </View>;
}
const styles=StyleSheet.create({
 banner:{flexDirection:"row",alignItems:"center",gap:9,backgroundColor:"#FFF2EE",paddingHorizontal:11,
  paddingVertical:8,borderBottomWidth:1,borderBottomColor:"#EBC9BE"},
 text:{flex:1,color:theme.danger,fontSize:12,lineHeight:18},
 button:{minHeight:40,justifyContent:"center",paddingHorizontal:5},
 link:{color:theme.danger,fontSize:12,fontWeight:"800"}
});
