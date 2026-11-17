import {Tabs} from "expo-router";
import {Ionicons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {t} from "@dineflow/shared";
import {useLocale} from "../../src/locale";
import {theme} from "../../src/theme";
import {f} from "../../src/floor";
import {useReadyAlertBadge} from "../../src/use-ready-alert-badge";
import {o5} from "../../src/order-copy";
export default function MainLayout(){
 const {locale}=useLocale(),insets=useSafeAreaInsets();
 const unread=useReadyAlertBadge();
 const icon=(name:React.ComponentProps<typeof Ionicons>["name"])=>({color,size,focused}:{color:string;size:number;focused:boolean})=>
  <Ionicons name={focused?name:({
    "home":"home-outline","grid":"grid-outline","receipt":"receipt-outline",
    "restaurant":"restaurant-outline","ellipsis-horizontal-circle":"ellipsis-horizontal-circle-outline"
   } as const)[name as "home"|"grid"|"receipt"|"restaurant"|"ellipsis-horizontal-circle"]??name}
   size={Math.min(size,23)} color={color}/>;
 return <Tabs initialRouteName="home" screenOptions={{
  headerShown:false,tabBarHideOnKeyboard:true,
  tabBarActiveTintColor:theme.brand,tabBarInactiveTintColor:theme.muted,
  tabBarStyle:{height:61+Math.max(insets.bottom,7),paddingBottom:Math.max(insets.bottom,7),
   paddingTop:7,backgroundColor:theme.surface,borderTopColor:theme.border,
   borderTopWidth:1,elevation:8,shadowColor:"#18382B",shadowOpacity:.09,shadowRadius:9},
  tabBarLabelStyle:{fontSize:10,fontWeight:"800",paddingBottom:2},
  tabBarItemStyle:{minHeight:48},
 }}>
  <Tabs.Screen name="home" options={{title:t(locale,"home"),tabBarIcon:icon("home")}}/>
  <Tabs.Screen name="tables" options={{title:f(locale,"tables"),tabBarIcon:icon("grid")}}/>
  <Tabs.Screen name="orders" options={{title:o5(locale,"orders"),tabBarIcon:icon("receipt")}}/>
  <Tabs.Screen name="menu" options={{title:o5(locale,"menu"),tabBarIcon:icon("restaurant")}}/>
  <Tabs.Screen name="more" options={{title:t(locale,"more"),tabBarIcon:icon("ellipsis-horizontal-circle"),
   tabBarBadge:unread&&unread>0?unread>99?"99+":unread:undefined,
   tabBarBadgeStyle:{backgroundColor:theme.danger,color:"#fff",fontSize:10,fontWeight:"800"}}}/>
 </Tabs>;
}
