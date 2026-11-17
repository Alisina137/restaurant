import {strict as assert} from "node:assert";
import {existsSync,readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const paths=[
 "apps/mobile/app/(main)/_layout.tsx","apps/mobile/app/(main)/home.tsx",
 "apps/mobile/app/(main)/tables.tsx","apps/mobile/app/(main)/orders.tsx",
 "apps/mobile/app/(main)/menu.tsx","apps/mobile/app/(main)/more.tsx",
 "apps/mobile/src/mobile23-ui.tsx","apps/mobile/src/use-live-screen.ts",
 "apps/mobile/src/mobile23-copy.ts","apps/mobile/src/mobile23-data.ts",
 "apps/mobile/src/mobile23-ci.ts"];
for(const p of paths)assert.ok(existsSync(new URL(p,root)),"Missing mobile Phase 23 file: "+p);
const [layout,home,tables,orders,menu,more,ui,hook,copy,data,tests]=paths.map(read);
const requireAll=(source,terms,title)=>{
 for(const text of terms)assert.ok(source.includes(text),"Missing "+title+": "+text);
};
requireAll(layout,['Tabs','tabBarHideOnKeyboard','useSafeAreaInsets','initialRouteName="home"',
  'useReadyAlertBadge','name="home"','name="tables"','name="orders"','name="menu"','name="more"',
  'tabBarBadge','tabBarItemStyle'],'5-tab native navigation');
assert.ok(read("apps/mobile/app/_layout.tsx").includes("SafeAreaProvider"));
requireAll(ui,['useSafeAreaInsets','ScreenHeader','LiveNotice','LoadingPanel','EmptyPanel',
 'MetricCard','QuickLink','Pill','Pager','SectionHeading','accessibilityRole',
 'rtl?"row-reverse":"row"'],'reusable native UI');
requireAll(hook,['useFocusEffect','AppState','sequence.current','snapshotRef.current',
 'focused.current','AppState.currentState','lastUpdated','status===401',
 'clearInterval','app.remove()'],'focus-aware polling and in-flight safety');
requireAll(home,['fetchIdentity','role!=="waiter"','Promise.allSettled','/api/floor/tables/board',
 '/api/orders/my/stats','/api/guest/staff/approvals/count','/api/service/requests/count',
 '/api/orders/notifications?unread=1&page=1','floorMetrics','MetricCard','QuickLink',
 'noRole','router.push("/requests")','router.push("/approvals")',
 'router.push("/notifications")','refresh(true)'],'real service dashboard');
requireAll(tables,['FlatList','filterFloorTables','floorMetrics','Pill',
 'assignedWaiterId','sectionId','useLiveScreen','/api/orders/my?status=ready',
 '/api/service/requests?status=active','kind:"request"','kind:"ready"',
 'router.push("/requests")','/table/[id]','RefreshControl'],
 'virtualized floor sections and attention feed');
requireAll(orders,['FlatList','orderTab','useLocalSearchParams','Pager',
 '/api/orders/my?status=','accessibilityRole="tab"','status==="ready"','useLiveScreen',
 '/order/[id]','new Date(item.createdAt)','RefreshControl'],'live order tabs');
requireAll(menu,['FlatList','selectableVisits','/api/menu/catalog',
 '/api/floor/tables/board','category','filtered','MenuCard','MenuData',
 'readOnly','item.soldOut','/visit/[id]/new-order','Modal','ScrollView',
 'useLiveScreen'],'real menu and assigned visit routing');
requireAll(more,['fetchIdentity','/api/orders/notifications?page=1&unread=1',
 'SecureStore','vibrationKey','Switch','authClient.signOut','Alert.alert',
 'QuickLink','/requests','/approvals','/profile','/security',
 'useLiveScreen'],'settings, account, role and signout');
requireAll(data,['floorMetrics','filterFloorTables','selectableVisits','orderTab',
 'assignedWaiterId===board.actorId','status==="occupied"',
 'view.tab==="attention"','sectionId','toLocaleLowerCase'],'real-data selectors');
requireAll(copy,['const en=','const fa:','const ps:','m23(locale:Locale',
 'noConnection','chooseTable','secureHint','vibrationOn','role','signout'],'Dari/Pashto/English language');
requireAll(tests,['assert.deepEqual(metrics','assigned-order safety','"attention"',
 '"fa-AF"','"ps-AF"','"en"'],'selector tests');
// New screens are intentionally read-only where server mutations are absent.
assert.ok(!home.includes('changeLocale(data.locale)'),
 "A background homepage refresh must never overwrite a user's chosen language.");
assert.ok(!menu.includes('method:"POST"'),"Browsing the menu cannot simulate ordering.");
console.info("PASS P23 static contracts: stable safe-area tabs, real waiter stats, virtualized catalog/boards, role checks, locale persistence and reconnect-safe loading.");
