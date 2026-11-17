"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {
  ChevronDown,ChevronLeft,ChevronRight,
  CircleUserRound,LogOut,Menu,PanelLeftClose,PanelLeftOpen,UtensilsCrossed,X
} from "lucide-react";
import {direction,t,webAreaFor,type Locale,type WebArea} from "@dineflow/shared";
import {authClient} from "@/lib/auth-client";
import {ApiError,getContext,type WorkspaceContext} from "@/lib/context";
import {WorkspaceProvider} from "./workspace-provider";
import {activeNavLocation,getWorkspaceNavigation,navItemMatches} from "@/lib/workspace-navigation";

const rootRoutes:Record<WebArea,string>={
  app:"/app/overview",kitchen:"/kitchen/live",cashier:"/cashier/checks",platform:"/platform/overview"
};
function label(locale:Locale,en:string,fa:string,ps:string){
  return locale==="en"?en:locale==="ps-AF"?ps:fa;
}
const collapseKey=(area:WebArea)=>"dineflow:nav:collapsed:"+area;
const groupsKey=(area:WebArea)=>"dineflow:nav:groups:"+area;

export function RoleShell({children}:{children:React.ReactNode}){
  const pathname=usePathname(),router=useRouter();
  const area=pathname.split("/")[1] as WebArea;
  const root=rootRoutes[area];
  const [workspace,setWorkspace]=useState<WorkspaceContext|null>(null);
  const [loadError,setLoadError]=useState("");
  const [pending,setPending]=useState(true);
  const [offline,setOffline]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [smallScreen,setSmallScreen]=useState(false);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [openGroups,setOpenGroups]=useState<Record<string,boolean>>({});
  const [navReady,setNavReady]=useState(false);
  const [signingOut,setSigningOut]=useState(false);
  const [signOutError,setSignOutError]=useState(false);
  const sidebarRef=useRef<HTMLElement|null>(null);
  const menuButtonRef=useRef<HTMLButtonElement|null>(null);
  const locale:Locale=workspace?.locale??"fa-AF";
  const rtl=direction(locale)==="rtl";
  const navigation=useMemo(()=>root?getWorkspaceNavigation(area,locale):[],[area,locale,root]);
  const active=useMemo(()=>activeNavLocation(pathname,navigation),[pathname,navigation]);
  const activeGroupId=active?.group.id;

  useEffect(()=>{
    const sync=()=>setOffline(navigator.onLine===false);
    sync();window.addEventListener("online",sync);window.addEventListener("offline",sync);
    return()=>{window.removeEventListener("online",sync);window.removeEventListener("offline",sync);};
  },[]);
  const refresh=useCallback(async()=>{
    setLoadError("");
    try{
      const result=await getContext();
      if(webAreaFor(result.role)!==area){router.replace(result.defaultRoute);return;}
      setWorkspace(result);
    }catch(error){
      if(error instanceof ApiError&&error.status===401)router.replace("/login?expired=1");
      else if(error instanceof ApiError&&error.status===403)setLoadError("NO_MEMBERSHIP");
      else setLoadError("CONNECTION");
    }finally{setPending(false);}
  },[area,router]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    document.documentElement.dir=direction(locale);
    document.documentElement.lang=locale;
    localStorage.setItem("dineflow-locale",locale);
  },[locale]);

  // Keep the desktop rail preference and individual section states across routes/reloads.
  useEffect(()=>{
    let stored:Record<string,boolean>={};
    try{
      setCollapsed(localStorage.getItem(collapseKey(area))==="1");
      const raw=localStorage.getItem(groupsKey(area));
      if(raw){
        const parsed:unknown=JSON.parse(raw);
        if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))
          for(const [key,value] of Object.entries(parsed))if(typeof value==="boolean")stored[key]=value;
      }
    }catch{/* Private browsing or disabled storage: use sensible defaults. */}
    if(activeGroupId)stored[activeGroupId]=true;
    setOpenGroups(stored);setNavReady(true);
  // Area changes remount the workspace; do not reset a user's open groups on every route.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[area]);
  useEffect(()=>{
    if(!navReady||!activeGroupId)return;
    setOpenGroups(prev=>prev[activeGroupId]?prev:{...prev,[activeGroupId]:true});
  },[pathname,activeGroupId,navReady]);
  useEffect(()=>{
    if(!navReady)return;
    try{localStorage.setItem(groupsKey(area),JSON.stringify(openGroups));}
    catch{/* Navigation still works without storage. */}
  },[area,openGroups,navReady]);
  function toggleRail(){
    setCollapsed(prev=>{
      const next=!prev;
      try{localStorage.setItem(collapseKey(area),next?"1":"0");}catch{}
      return next;
    });
  }
  function toggleGroup(id:string,expanded:boolean){
    setOpenGroups(prev=>({...prev,[id]:!expanded}));
  }
  useEffect(()=>{setDrawerOpen(false);},[pathname]);
  useEffect(()=>{
    const media=window.matchMedia("(max-width: 768px)");
    const sync=()=>setSmallScreen(media.matches);
    sync();media.addEventListener("change",sync);
    return()=>media.removeEventListener("change",sync);
  },[]);
  // The small-screen menu is a real modal drawer: escape, focus trap, restore focus and scroll lock.
  useEffect(()=>{
    if(!drawerOpen)return;
    const media=window.matchMedia("(max-width: 768px)");
    if(!media.matches){setDrawerOpen(false);return;}
    const previousFocus=document.activeElement as HTMLElement|null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const sidebar=sidebarRef.current;
    const focusable=()=>Array.from(sidebar?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )??[]).filter(el=>el.getClientRects().length>0);
    const first=focusable()[0];first?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();setDrawerOpen(false);return;}
      if(event.key!=="Tab")return;
      const nodes=focusable();if(!nodes.length)return;
      const firstNode=nodes[0],lastNode=nodes[nodes.length-1];
      if(!firstNode||!lastNode)return;
      if(event.shiftKey&&(document.activeElement===firstNode||!sidebar?.contains(document.activeElement))){
        event.preventDefault();lastNode.focus();
      }else if(!event.shiftKey&&(document.activeElement===lastNode||!sidebar?.contains(document.activeElement))){
        event.preventDefault();firstNode.focus();
      }
    };
    const resize=()=>{if(!media.matches)setDrawerOpen(false);};
    window.addEventListener("keydown",keydown);
    window.addEventListener("resize",resize);
    return()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener("keydown",keydown);
      window.removeEventListener("resize",resize);
      if(menuButtonRef.current?.isConnected)menuButtonRef.current.focus();
      else if(previousFocus?.isConnected)previousFocus.focus();
    };
  },[drawerOpen]);

  async function signOut(){
    if(signingOut)return;
    setSigningOut(true);setSignOutError(false);
    try{await authClient.signOut();router.replace("/login");}
    catch{setSignOutError(true);}
    finally{setSigningOut(false);}
  }
  if(!root)return <div className="center-viewport">Invalid workspace.</div>;
  const currentTitle=active?.item.label??t(locale,"workspace");
  const closeText=label(locale,"Close navigation","بستن فهرست","لړ بندول");
  const openText=label(locale,"Open navigation","باز کردن فهرست","لړ پرانیستل");
  const navigationText=label(locale,"Workspace navigation","فهرست فضای کاری","د کاري ځای لړ");
  const accountPath="/"+area+"/account";
  const currentAccount=pathname===accountPath||pathname.startsWith(accountPath+"/");
  return <div className="workspace-layout" dir={direction(locale)}
      data-collapsed={collapsed?"true":"false"} data-mobile-open={drawerOpen?"true":"false"}>
    <a href="#main-content" className="skip-content-link">
      {label(locale,"Skip to main content","رفتن به محتوای اصلی","اصلي منځپانګې ته لاړ شئ")}
    </a>
    {drawerOpen&&<button type="button" tabIndex={-1} aria-label={closeText}
      className="workspace-drawer-scrim" onClick={()=>setDrawerOpen(false)}/>}
    <aside id="workspace-navigation" ref={sidebarRef}
      className="sidebar workspace-sidebar" aria-label={navigationText}
      role={drawerOpen?"dialog":"complementary"} aria-modal={drawerOpen?"true":undefined}>
      <div className="workspace-sidebar-top">
        <Link className="sidebar-brand" href={root} title="DineFlow"
          aria-label="DineFlow" onClick={()=>setDrawerOpen(false)}>
          <span className="brand-mark"><UtensilsCrossed size={20}/></span>
          <strong>DineFlow</strong>
        </Link>
        <button type="button" className="workspace-sidebar-close" aria-label={closeText}
          title={closeText} onClick={()=>setDrawerOpen(false)}><X size={20}/></button>
        <button type="button" className="workspace-sidebar-collapse" onClick={toggleRail}
          aria-label={collapsed?label(locale,"Expand sidebar","باز کردن نوار کناری","اړخیز لړ پراخول"):
            label(locale,"Collapse sidebar","جمع کردن نوار کناری","اړخیز لړ راټولول")}
          title={collapsed?label(locale,"Expand sidebar","باز کردن نوار کناری","اړخیز لړ پراخول"):
            label(locale,"Collapse sidebar","جمع کردن نوار کناری","اړخیز لړ راټولول")}>
          {collapsed?<PanelLeftOpen size={20}/>:<PanelLeftClose size={20}/>}
        </button>
      </div>
      <nav className="sidebar-nav workspace-sidebar-nav" aria-label={navigationText}>
        {navigation.map(group=>{
          const expanded=(!smallScreen&&collapsed)||(openGroups[group.id]??group.id===activeGroupId);
          const anyActive=group.items.some(item=>navItemMatches(pathname,item));
          const GroupIcon=group.icon;
          return <section key={group.id} className={"workspace-nav-group"+(anyActive?" group-active":"")}
              aria-label={group.label}>
            <button type="button" className="workspace-nav-group-toggle"
              aria-expanded={expanded} aria-controls={"workspace-group-"+group.id}
              onClick={()=>toggleGroup(group.id,expanded)} title={group.label}>
              <GroupIcon size={18} strokeWidth={1.9}/><span>{group.label}</span>
              <ChevronDown size={16} className={"workspace-group-chevron"+(expanded?" open":"")}/>
            </button>
            <div className="workspace-nav-items" id={"workspace-group-"+group.id} hidden={!expanded}>
              {group.items.map(item=>{
                const ItemIcon=item.icon;
                const selected=navItemMatches(pathname,item);
                return <Link key={item.href} href={item.href}
                  className={"nav-link workspace-nav-link"+(selected?" selected":"")}
                  aria-label={item.label} title={item.label} aria-current={selected?"page":undefined}
                  onClick={()=>setDrawerOpen(false)}>
                  <ItemIcon size={20} strokeWidth={1.9} aria-hidden="true"/>
                  <span>{item.label}</span>
                </Link>;
              })}
            </div>
          </section>;
        })}
      </nav>
      <div className="sidebar-bottom workspace-sidebar-footer">
        <Link className={"nav-link workspace-nav-link"+(currentAccount?" selected":"")}
          href={accountPath} aria-label={t(locale,"account")} aria-current={currentAccount?"page":undefined}
          title={t(locale,"account")} onClick={()=>setDrawerOpen(false)}>
          <CircleUserRound size={20} aria-hidden="true"/><span>{t(locale,"account")}</span>
        </Link>
        <button className="nav-link nav-action workspace-nav-link" type="button"
          disabled={signingOut} title={t(locale,"signOut")} aria-label={t(locale,"signOut")}
          onClick={()=>void signOut()}>
          <LogOut size={20} aria-hidden="true"/><span>{signingOut?t(locale,"loading"):t(locale,"signOut")}</span>
        </button>
        {signOutError&&<p className="workspace-sidebar-error" role="alert">{t(locale,"offline")}</p>}
      </div>
    </aside>
    <div className="workspace-column" inert={drawerOpen}>
      <header className="workspace-header">
        <div className="workspace-header-left">
          <button type="button" className="workspace-mobile-menu" ref={menuButtonRef}
            aria-label={openText} title={openText} aria-expanded={drawerOpen}
            aria-controls="workspace-navigation" onClick={()=>setDrawerOpen(true)}>
            <Menu size={23}/>
          </button>
          <div className="header-heading">
            <div className="workspace-crumbs" aria-label={label(locale,"Location","موقعیت","ځای")}>
              <span>{workspace?.tenantName??"DineFlow"}</span>
              {rtl?<ChevronLeft size={14} aria-hidden="true"/>:<ChevronRight size={14} aria-hidden="true"/>}
              <span>{active?.group.label??t(locale,"workspace")}</span>
            </div>
            <strong>{currentAccount?t(locale,"account"):currentTitle}</strong>
          </div>
        </div>
        <div className="header-actions">
          <span className={"online-indicator"+(offline?" is-offline":"")}
            title={offline?label(locale,"No network","شبکه قطع است","شبکه نشته"):
              label(locale,"Network connected","شبکه وصل است","شبکه نښلول شوې")} aria-hidden="true"/>
          <span className="desktop-only">{workspace?.user.name??""}</span>
          <Link className="avatar-button" href={accountPath} aria-label={t(locale,"account")}
            title={t(locale,"account")}><CircleUserRound size={24}/></Link>
        </div>
      </header>
      {offline&&<div className="workspace-offline" role="status" aria-live="polite">
        {label(locale,"You are offline. Changes may not be saved; reconnect and refresh.",
          "شما آفلاین هستید. تغییرات ممکن است ذخیره نشوند؛ دوباره وصل شوید و صفحه را تازه کنید.",
          "انټرنېټ نشته. بدلونونه ښايي خوندي نه شي؛ بېرته ونښلئ او تازه کړئ.")}
      </div>}
      <main className="workspace-main" id="main-content" tabIndex={-1} aria-busy={pending}>
        {pending?<div className="shell-loading" aria-live="polite"><span className="spinner"/>{t(locale,"loading")}</div>:
        loadError?<section className="error-panel" role="alert">
          <h2>{t(locale,loadError==="NO_MEMBERSHIP"?"noMembership":"offline")}</h2>
          <button className="button button-primary" onClick={()=>{setPending(true);void refresh();}}>{t(locale,"retry")}</button>
        </section>:
        workspace?<WorkspaceProvider.Provider value={{workspace,setWorkspace}}>{children}</WorkspaceProvider.Provider>:null}
      </main>
    </div>
  </div>;
}
