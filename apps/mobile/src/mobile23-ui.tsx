import type {ReactNode} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Ionicons} from "@expo/vector-icons";
import {direction,type Locale} from "@dineflow/shared";
import {m23,type Mobile23Key} from "./mobile23-copy";
import {theme} from "./theme";

export function ScreenHeader({locale,title,caption,subtitle,onRefresh,refreshing=false,
 action}:{locale:Locale;title:string;caption?:string;subtitle?:string;
 onRefresh?:()=>void;refreshing?:boolean;action?:ReactNode}){
 const safe=useSafeAreaInsets(),rtl=direction(locale)==="rtl";
 return <View style={[styles.header,{paddingTop:safe.top+12,flexDirection:rtl?"row-reverse":"row"}]}>
  <View style={styles.heading}>
   <Text style={[styles.caption,{textAlign:rtl?"right":"left"}]}>{caption??"DINEFLOW / SERVICE"}</Text>
   <Text style={[styles.title,{textAlign:rtl?"right":"left"}]}>{title}</Text>
   {!!subtitle&&<Text style={[styles.subtitle,{textAlign:rtl?"right":"left"}]}>{subtitle}</Text>}
  </View>
  <View style={styles.headerAction}>{action}
   {onRefresh&&<Pressable accessibilityRole="button" accessibilityLabel={m23(locale,"refresh")}
    disabled={refreshing} onPress={onRefresh} style={[styles.roundAction,refreshing&&styles.disabled]}>
     {refreshing?<ActivityIndicator color={theme.brand} size="small"/>:
       <Ionicons name="refresh-outline" color={theme.brand} size={22}/>}
   </Pressable>}
  </View>
 </View>;
}
export function LiveNotice({locale,error,lastUpdated,onRetry,hasData=false}:{
 locale:Locale;error:string;lastUpdated?:number|null;onRetry:()=>void;hasData?:boolean;
}){
 const rtl=direction(locale)==="rtl";
 return <View style={styles.noticeStack}>
  {!!error&&<View accessibilityRole="alert" style={[styles.error,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Ionicons name="cloud-offline-outline" color={theme.danger} size={21}/>
   <View style={{flex:1,gap:3}}><Text style={[styles.errorTitle,{textAlign:rtl?"right":"left"}]}>
    {m23(locale,hasData?"outdated":"disconnected")}</Text>
    {!hasData&&<Text style={styles.errorDetail} numberOfLines={2}>{error}</Text>}
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel={m23(locale,"retry")}
    onPress={onRetry} style={styles.retry}><Ionicons name="refresh" size={18} color={theme.brand}/></Pressable>
  </View>}
  {lastUpdated&&!error&&<View style={[styles.updated,{flexDirection:rtl?"row-reverse":"row"}]}>
    <Ionicons name="checkmark-circle-outline" size={15} color={theme.status.success}/>
    <Text style={styles.updatedText}>{m23(locale,"lastUpdated")} · {new Date(lastUpdated).toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})}</Text>
   </View>}
 </View>;
}
export function LoadingPanel({locale,label}:{locale:Locale;label?:string}){
 return <View style={styles.loading}>
  <ActivityIndicator size="large" color={theme.brand}/>
  <Text style={styles.loadingText}>{label??m23(locale,"loading")}</Text>
  <View style={styles.skeleton}/>
  <View style={[styles.skeleton,{width:"72%"}]}/>
  <View style={[styles.skeleton,{width:"85%"}]}/>
 </View>;
}
export function EmptyPanel({locale,icon="search-outline",title,hint,onAction,actionLabel}:{
 locale:Locale;icon?:React.ComponentProps<typeof Ionicons>["name"];title:string;
 hint?:string;onAction?:()=>void;actionLabel?:string;
}){
 return <View style={styles.empty}>
  <View style={styles.emptyIcon}><Ionicons name={icon} size={31} color={theme.brand}/></View>
  <Text style={styles.emptyTitle}>{title}</Text>
  {!!hint&&<Text style={styles.emptyHint}>{hint}</Text>}
  {!!onAction&&<Pressable accessibilityRole="button" onPress={onAction} style={styles.emptyAction}>
   <Text style={styles.emptyActionText}>{actionLabel??m23(locale,"retry")}</Text>
  </Pressable>}
 </View>;
}
export function SectionHeading({locale,title,actionLabel,onAction,icon}:{
 locale:Locale;title:string;actionLabel?:string;onAction?:()=>void;
 icon?:React.ComponentProps<typeof Ionicons>["name"];
}){
 const rtl=direction(locale)==="rtl";
 return <View style={[styles.sectionHead,{flexDirection:rtl?"row-reverse":"row"}]}>
  <View style={[styles.sectionHeadTitle,{flexDirection:rtl?"row-reverse":"row"}]}>
   {icon&&<Ionicons name={icon} size={19} color={theme.brand}/>}
   <Text style={styles.sectionTitle}>{title}</Text>
  </View>
  {onAction&&<Pressable accessibilityRole="button" onPress={onAction} style={[styles.sectionAction,{flexDirection:rtl?"row-reverse":"row"}]}>
   <Text style={styles.sectionLink}>{actionLabel??m23(locale,"seeAll")}</Text>
   <Ionicons name={rtl?"arrow-back":"arrow-forward"} size={15} color={theme.brand}/>
  </Pressable>}
 </View>;
}
export function MetricCard({locale,value,label,icon,onPress,kind="normal"}:{
 locale:Locale;value:number|null;label:string;icon:React.ComponentProps<typeof Ionicons>["name"];
 onPress:()=>void;kind?:"normal"|"attention"|"ready";
}){
 const rtl=direction(locale)==="rtl";
 return <Pressable accessibilityRole="button" accessibilityLabel={label+" "+(value??m23(locale,"unknown"))}
  onPress={onPress} style={[styles.metric,kind==="attention"&&styles.metricAttention,
   kind==="ready"&&styles.metricReady]}>
  <View style={[styles.metricTop,{flexDirection:rtl?"row-reverse":"row"}]}>
   <View style={[styles.metricIcon,kind==="attention"&&styles.metricIconAttention]}>
    <Ionicons name={icon} size={20} color={kind==="attention"?theme.status.warning:theme.brand}/>
   </View>
   <Ionicons name={rtl?"arrow-back":"arrow-forward"} size={16} color={theme.muted}/>
  </View>
  <Text style={[styles.metricNumber,{textAlign:rtl?"right":"left"}]}>{value===null?"—":new Intl.NumberFormat(locale).format(value)}</Text>
  <Text style={[styles.metricLabel,{textAlign:rtl?"right":"left"}]}>{label}</Text>
 </Pressable>;
}
export function QuickLink({locale,label,description,icon,onPress,badge}:{
 locale:Locale;label:string;description?:string;icon:React.ComponentProps<typeof Ionicons>["name"];
 onPress:()=>void;badge?:number|null;
}){
 const rtl=direction(locale)==="rtl";
 return <Pressable accessibilityRole="button" onPress={onPress}
  style={[styles.quickLink,{flexDirection:rtl?"row-reverse":"row"}]}>
  <View style={styles.quickIcon}><Ionicons name={icon} size={22} color={theme.brand}/></View>
  <View style={{flex:1,gap:3}}>
   <Text style={[styles.quickTitle,{textAlign:rtl?"right":"left"}]}>{label}</Text>
   {!!description&&<Text style={[styles.quickDescription,{textAlign:rtl?"right":"left"}]}>{description}</Text>}
  </View>
  {!!badge&&badge>0&&<View style={styles.quickBadge}><Text style={styles.quickBadgeText}>{badge>99?"99+":badge}</Text></View>}
  <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={18} color={theme.muted}/>
 </Pressable>;
}
export function Pill({locale,label,onPress,selected=false,count}:{locale:Locale;label:string;
 onPress:()=>void;selected?:boolean;count?:number}){
 return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress}
  style={[styles.pill,selected&&styles.pillActive]}>
  <Text style={[styles.pillText,selected&&styles.pillTextActive]}>{label}</Text>
  {count!==undefined&&<Text style={[styles.pillCount,selected&&styles.pillTextActive]}>{count}</Text>}
 </Pressable>;
}
export function Pager({locale,page,total,perPage=10,onChange,disabled=false}:{
 locale:Locale;page:number;total:number;perPage?:number;onChange:(page:number)=>void;disabled?:boolean;
}){
 const pages=Math.max(1,Math.ceil(total/perPage));const rtl=direction(locale)==="rtl";
 if(pages<=1&&page<=1)return null;
 return <View style={[styles.pager,{flexDirection:rtl?"row-reverse":"row"}]}>
  <Pressable accessibilityRole="button" disabled={disabled||page<=1} onPress={()=>onChange(Math.max(1,page-1))}
   style={[styles.pagerButton,(disabled||page<=1)&&styles.disabled]}>
    <Ionicons name={rtl?"chevron-forward":"chevron-back"} size={17} color={theme.brand}/>
    <Text style={styles.pagerLabel}>{m23(locale,"previous")}</Text></Pressable>
  <Text style={styles.pagerText}>{m23(locale,"page")} {page} {m23(locale,"of")} {pages}</Text>
  <Pressable accessibilityRole="button" disabled={disabled||page>=pages} onPress={()=>onChange(Math.min(pages,page+1))}
   style={[styles.pagerButton,(disabled||page>=pages)&&styles.disabled]}>
    <Text style={styles.pagerLabel}>{m23(locale,"next")}</Text>
    <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={17} color={theme.brand}/>
   </Pressable>
 </View>;
}
const styles=StyleSheet.create({
 header:{alignItems:"center",justifyContent:"space-between",gap:10,paddingBottom:6},
 heading:{flex:1,minWidth:0,gap:4},
 caption:{fontSize:10,color:theme.brand,fontWeight:"900",letterSpacing:1.2},
 title:{color:theme.ink,fontSize:27,fontWeight:"900",letterSpacing:-.5},
 subtitle:{fontSize:12,color:theme.muted,lineHeight:20,marginTop:2},
 headerAction:{flexDirection:"row",gap:8,alignItems:"center"},
 roundAction:{height:45,width:45,borderRadius:14,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#D5EBDD"},
 disabled:{opacity:.4},
 noticeStack:{gap:8},
 error:{padding:14,alignItems:"flex-start",gap:11,borderWidth:1,borderColor:"#EDC8C1",borderRadius:14,backgroundColor:"#FFF4F0"},
 errorTitle:{color:"#A0523D",fontSize:12,fontWeight:"800",lineHeight:19},
 errorDetail:{fontSize:11,color:"#97665D",lineHeight:16},
 retry:{backgroundColor:"#fff",borderRadius:9,padding:8,borderWidth:1,borderColor:"#ECD5CD"},
 updated:{gap:6,alignItems:"center"},
 updatedText:{fontSize:11,color:theme.muted,fontWeight:"600"},
 loading:{padding:20,gap:17,alignItems:"center",justifyContent:"center",minHeight:210},
 loadingText:{color:theme.muted,fontSize:13},
 skeleton:{backgroundColor:"#E5F0E9",height:16,width:"95%",borderRadius:7},
 empty:{minHeight:190,alignItems:"center",justifyContent:"center",gap:10,padding:22,backgroundColor:"#fff",borderRadius:16,borderColor:theme.border,borderWidth:1},
 emptyIcon:{height:52,width:52,borderRadius:17,backgroundColor:theme.brandSoft,justifyContent:"center",alignItems:"center"},
 emptyTitle:{color:theme.ink,fontWeight:"800",fontSize:15,textAlign:"center",lineHeight:22},
 emptyHint:{color:theme.muted,fontSize:12,lineHeight:19,textAlign:"center"},
 emptyAction:{paddingHorizontal:20,paddingVertical:11,borderRadius:10,backgroundColor:theme.brand,marginTop:5,minHeight:43,alignItems:"center",justifyContent:"center"},
 emptyActionText:{color:"#fff",fontSize:12,fontWeight:"800"},
 sectionHead:{gap:8,justifyContent:"space-between",alignItems:"center"},
 sectionHeadTitle:{alignItems:"center",gap:7,flex:1},
 sectionTitle:{fontSize:17,fontWeight:"900",color:theme.ink},
 sectionAction:{alignItems:"center",gap:5,paddingVertical:10,paddingHorizontal:4},
 sectionLink:{fontWeight:"800",color:theme.brand,fontSize:12},
 metric:{minWidth:0,flex:1,borderRadius:17,backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,padding:14,gap:9,minHeight:145},
 metricAttention:{borderColor:"#EEDAB2",backgroundColor:"#FFFCF6"},
 metricReady:{borderColor:"#C2E4D1",backgroundColor:"#F8FEFA"},
 metricTop:{alignItems:"center",justifyContent:"space-between"},
 metricIcon:{width:35,height:35,borderRadius:11,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center"},
 metricIconAttention:{backgroundColor:theme.status.warningSoft},
 metricNumber:{fontSize:27,fontWeight:"900",color:theme.ink,fontVariant:["tabular-nums"]},
 metricLabel:{fontSize:12,fontWeight:"700",color:theme.muted,lineHeight:17},
 quickLink:{minHeight:65,padding:13,backgroundColor:"#fff",borderWidth:1,borderColor:theme.border,borderRadius:14,alignItems:"center",gap:12},
 quickIcon:{height:39,width:39,borderRadius:12,backgroundColor:theme.brandSoft,alignItems:"center",justifyContent:"center"},
 quickTitle:{fontSize:14,color:theme.ink,fontWeight:"800"},
 quickDescription:{fontSize:11,lineHeight:16,color:theme.muted},
 quickBadge:{borderRadius:99,minWidth:24,paddingHorizontal:6,paddingVertical:4,alignItems:"center",backgroundColor:"#B94932"},
 quickBadgeText:{fontSize:10,color:"#fff",fontWeight:"900"},
 pill:{borderWidth:1,borderColor:theme.border,backgroundColor:"#fff",paddingHorizontal:15,paddingVertical:10,borderRadius:99,flexDirection:"row",alignItems:"center",gap:7,minHeight:41},
 pillActive:{backgroundColor:theme.brandSoft,borderColor:"#A6D9BC"},
 pillText:{color:theme.muted,fontWeight:"800",fontSize:12},
 pillTextActive:{color:theme.brand},
 pillCount:{color:theme.muted,fontSize:11,fontWeight:"900"},
 pager:{justifyContent:"space-between",alignItems:"center",paddingVertical:13,gap:8},
 pagerButton:{alignItems:"center",flexDirection:"row",gap:5,backgroundColor:theme.brandSoft,borderRadius:10,paddingHorizontal:11,minHeight:42},
 pagerLabel:{color:theme.brand,fontWeight:"800",fontSize:12},
 pagerText:{fontWeight:"700",fontSize:12,color:theme.muted}
});
