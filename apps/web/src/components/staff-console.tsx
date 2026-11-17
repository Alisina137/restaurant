"use client";
import {type FormEvent,useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {AlertCircle,ArrowRight,CheckCircle2,Clock3,Filter,KeyRound,MailPlus,
 RefreshCcw,RefreshCw,ShieldCheck,UserRoundCog,UsersRound,LockKeyhole,Send,
 ShieldAlert,X,Check,BookUser} from "lucide-react";
import {type Locale,type StaffRole} from "@dineflow/shared";
import {useWorkspace} from "@/components/workspace-provider";
import {jsonRequest,Phase2Error,type PageResult} from "@/lib/phase2-api";
import {p2} from "@/lib/phase2-copy";
import {s22} from "@/lib/staff22-copy";
import {useInteraction} from "./ui/interaction-provider";
import {useDialogFocus} from "./ui/use-dialog-focus";
import {InlineFeedback,PageControls,FilterSelect,SearchInput} from "./ui/interaction-controls";
import {LoadingSkeleton} from "./ui/design-system";

const roles:StaffRole[]=["owner","manager","waiter","kitchen","cashier"];
type Member={id:string;userId:string;name:string;email:string;role:StaffRole;status:"active"|"disabled";createdAt:string};
type Invite={id:string;email:string;role:StaffRole;status:"pending"|"accepted"|"expired"|"revoked";
 deliveryStatus:"pending"|"sent"|"failed";expiresAt:string;createdAt:string;sendAttempts:number;acceptedAt:string|null};
type Overview={members:{total:number;active:number;disabled:number;byRole:Record<StaffRole,number>};
 invitations:{pending:number;failedDelivery:number};
 policy:{managerCanInvite:boolean};
 permissions:{canInvite:boolean;canManagePrivilegedRoles:boolean;allowedInviteRoles:StaffRole[]}};
type Tab="directory"|"invitations"|"permissions";
const dateText=(value:string,locale:Locale)=>new Date(value).toLocaleDateString(locale,{year:"numeric",month:"short",day:"numeric"});
function errorText(e:unknown,locale:Locale){
 if(e instanceof Phase2Error){
  if(e.code==="VERSION_CONFLICT")return s22(locale,"staleMember");
  if(e.code==="LAST_OWNER")return s22(locale,"lastOwner");
  if(e.code==="SELF_DISABLE")return s22(locale,"cannotDisableSelf");
  if(e.code==="INVITES_DISABLED")return s22(locale,"inviteRestricted");
 }
 return e instanceof Error?e.message:p2(locale,"error");
}
function Status({children,tone}:{children:React.ReactNode;tone:string}){
 return <span className={"p22-badge p22-"+tone}>{children}</span>;
}
export function StaffConsole({tab}:{tab:Tab}){
 const {workspace}=useWorkspace(),locale=workspace.locale;
 const {confirm,notify}=useInteraction();
 const lock=useRef(false),requestId=useRef(0);
 const [overview,setOverview]=useState<Overview|null>(null);
 const [members,setMembers]=useState<PageResult<Member>|null>(null);
 const [invites,setInvites]=useState<PageResult<Invite>|null>(null);
 const [page,setPage]=useState(1),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [searchText,setSearchText]=useState(""),[query,setQuery]=useState("");
 const [roleFilter,setRoleFilter]=useState("all"),[statusFilter,setStatusFilter]=useState("all"),[deliveryFilter,setDeliveryFilter]=useState("all");
 const [inviteEmail,setInviteEmail]=useState(""),[inviteRole,setInviteRole]=useState<StaffRole>("waiter");
 const [message,setMessage]=useState("");
 const [editing,setEditing]=useState<Member|null>(null),[nextRole,setNextRole]=useState<StaffRole>("waiter");
 const [nextStatus,setNextStatus]=useState<"active"|"disabled">("active");
 const editDialogRef=useDialogFocus<HTMLFormElement>(!!editing,()=>{if(!busy)setEditing(null);});
 const manager=workspace.role==="manager",owner=workspace.role==="owner";
 const canInvite=overview?.permissions.canInvite??owner;
 const inviteRoles=overview?.permissions.allowedInviteRoles??(owner?roles:["waiter","kitchen","cashier"] as StaffRole[]);
 const canEdit=(person:Member)=>owner||(
  manager&&person.userId!==workspace.user.id&&["waiter","kitchen","cashier"].includes(person.role));
 const changeFilters=(key:"role"|"status"|"delivery",value:string)=>{
  setPage(1);if(key==="role")setRoleFilter(value);
  if(key==="status")setStatusFilter(value);
  if(key==="delivery")setDeliveryFilter(value);
 };
 const load=useCallback(async(silent=false,requestedPage=page)=>{
  const request=++requestId.current;
  if(!silent)setLoading(true);
  try{
   const params=new URLSearchParams({page:String(requestedPage),...(query?{q:query}:{}),
    ...(roleFilter!=="all"?{role:roleFilter}:{})});
   if(statusFilter!=="all")params.set("status",statusFilter);
   if(tab==="invitations"&&deliveryFilter!=="all")params.set("delivery",deliveryFilter);
   const [summary,list]=await Promise.all([
    jsonRequest<Overview>("/api/tenant/staff/overview"),
    tab==="directory"?jsonRequest<PageResult<Member>>("/api/tenant/staff?"+params.toString()):
    tab==="invitations"?jsonRequest<PageResult<Invite>>("/api/tenant/invitations?"+params.toString()):
    Promise.resolve(null)
   ]);
   if(request!==requestId.current)return;
   setOverview(summary);
   if(tab==="directory"&&list)setMembers(list as PageResult<Member>);
   if(tab==="invitations"&&list)setInvites(list as PageResult<Invite>);
   setError("");
  }catch(e){if(request===requestId.current)setError(errorText(e,locale));}
  finally{if(request===requestId.current)setLoading(false);}
 },[page,tab,locale,query,roleFilter,statusFilter,deliveryFilter]);
 useEffect(()=>{void load();return()=>{requestId.current++;};},[load]);
 useEffect(()=>{
  const again=()=>{if(document.visibilityState==="visible"&&navigator.onLine)void load(true);};
  window.addEventListener("online",again);document.addEventListener("visibilitychange",again);
  return()=>{window.removeEventListener("online",again);document.removeEventListener("visibilitychange",again);};
 },[load]);
 useEffect(()=>{if(!inviteRoles.includes(inviteRole))setInviteRole("waiter");},[inviteRoles,inviteRole]);
 function startEdit(person:Member){
  if(!canEdit(person))return;
  setEditing(person);setNextRole(person.role);setNextStatus(person.status);setError("");
 }
 async function updateMember(e:FormEvent){
  e.preventDefault();const person=editing;
  if(!person||!canEdit(person)||lock.current||busy)return;
  if(nextRole===person.role&&nextStatus===person.status){setEditing(null);return;}
  if(nextStatus==="disabled"&&person.userId===workspace.user.id){
   setError(s22(locale,"cannotDisableSelf"));return;
  }
  const changedStatus=nextStatus!==person.status;
  const description=nextStatus==="disabled"?s22(locale,"disableWarning"):
    changedStatus?s22(locale,"enableWarning"):s22(locale,"roleWarning");
  if(!(await confirm({title:s22(locale,"editMember"),description,
    confirmLabel:s22(locale,"save"),cancelLabel:s22(locale,"cancel"),danger:nextStatus==="disabled"})))return;
  if(lock.current)return;
  lock.current=true;setBusy(true);setError("");
  try{
   await jsonRequest("/api/tenant/staff/"+person.id,{method:"PATCH",
    body:JSON.stringify({role:nextRole,status:nextStatus,
      expectedRole:person.role,expectedStatus:person.status})});
   setEditing(null);
   notify(s22(locale,"roleUpdated"),"success");await load(true);
  }catch(error){setError(errorText(error,locale));}
  finally{lock.current=false;setBusy(false);}
 }
 async function createInvite(e:FormEvent){
  e.preventDefault();if(lock.current||!canInvite||busy)return;
  lock.current=true;setBusy(true);setError("");
  try{
   const result=await jsonRequest<{deliveryStatus:string}>("/api/tenant/invitations",{
    method:"POST",body:JSON.stringify({email:inviteEmail.trim().toLowerCase(),role:inviteRole,
      message:message.trim()})});
   setInviteEmail("");setMessage("");setPage(1);
   if(result.deliveryStatus==="failed")notify(s22(locale,"inviteDeliveryFailed"),"error");
   else notify(s22(locale,"inviteSent"),"success");
   await load(true,1);
  }catch(error){setError(errorText(error,locale));}
  finally{lock.current=false;setBusy(false);}
 }
 async function inviteAction(item:Invite,action:"revoke"|"resend"){
  if(lock.current||!canInvite||busy)return;
  if(action==="revoke"&&!(await confirm({title:s22(locale,"revoke"),
    description:s22(locale,"revokeWarning"),confirmLabel:s22(locale,"revoke"),
    cancelLabel:s22(locale,"cancel"),danger:true})))return;
  if(lock.current)return;
  lock.current=true;setBusy(true);setError("");
  try{
   const result=await jsonRequest<{deliveryStatus?:string}>(
    "/api/tenant/invitations/"+item.id+"/"+action,{method:"POST",body:"{}"});
   if(result.deliveryStatus==="failed")notify(s22(locale,"inviteDeliveryFailed"),"error");
   else notify(s22(locale,action==="revoke"?"inviteRevoked":"inviteResent"),"success");
   await load(true);
  }catch(error){setError(errorText(error,locale));}
  finally{lock.current=false;setBusy(false);}
 }
 const options=[{value:"all",label:s22(locale,"allRoles")},
  ...roles.map(role=>({value:role,label:p2(locale,role)}))];
 const statusOptions=tab==="directory"?[
  {value:"all",label:s22(locale,"allStatuses")},
  {value:"active",label:p2(locale,"active")},{value:"disabled",label:p2(locale,"disabled")}]:
  [{value:"all",label:s22(locale,"allStatuses")},
   ...(["pending","expired","accepted","revoked"] as const).map(value=>({value,label:p2(locale,value)}))];
 const tabItems=[{key:"directory",icon:UsersRound},{key:"invitations",icon:MailPlus},
  {key:"permissions",icon:ShieldCheck}] as const;
 const total=tab==="directory"?members?.total??0:invites?.total??0;
 const result=tab==="directory"?members:invites;
 const hasFilters=!!query||!!searchText||roleFilter!=="all"||statusFilter!=="all"||
  (tab==="invitations"&&deliveryFilter!=="all");
 function resetFilters(){setSearchText("");setQuery("");setPage(1);
  setRoleFilter("all");setStatusFilter("all");setDeliveryFilter("all");}
 const editedDirty=!!editing&&(editing.role!==nextRole||editing.status!==nextStatus);
 return <div className="content-stack p22-staff-console">
  <header className="page-heading"><div>
   <div className="eyebrow">DINEFLOW / {p2(locale,"restaurant")} / {p2(locale,"team")}</div>
   <h1>{p2(locale,"team")}</h1><p>{s22(locale,"teamOverviewHint")}</p></div>
   <div className="p22-page-actions">
    <button className="button" type="button" disabled={loading||busy}
     onClick={()=>void load()}><RefreshCw size={17}/>{s22(locale,"refresh")}</button>
    {tab!=="invitations"&&canInvite&&<Link className="button button-primary" href="/app/staff/invitations">
      <MailPlus size={18}/>{p2(locale,"invite")}</Link>}
   </div>
  </header>
  <nav className="context-tabs p22-tabs" aria-label={p2(locale,"team")}>
   {tabItems.map(({key,icon:Icon})=><Link key={key} href={"/app/staff/"+key}
    aria-current={tab===key?"page":undefined} className={"context-tab"+(tab===key?" current":"")}>
    <Icon size={18}/>{p2(locale,key)}</Link>)}
  </nav>
  {error&&<InlineFeedback message={error} retry={()=>void load()} onRetryLabel={s22(locale,"retry")}/>}
  <section className="p22-summary" aria-labelledby="p22-summary-title">
   <div className="p22-summary-heading"><div><span className="eyebrow">OPERATIONS / TEAM</span>
    <h2 id="p22-summary-title">{s22(locale,"teamOverview")}</h2></div>
    <span className="p22-audit-note"><ShieldCheck size={16}/>{s22(locale,"pageSummary")}</span></div>
   {loading&&!overview?<LoadingSkeleton rows={2} label={s22(locale,"loading")}/>:
    overview&&<><div className="p22-summary-cards">
     {([{key:"activeTeam" as const,value:overview.members.active,icon:UsersRound,accent:"active"},
       {key:"disabledTeam" as const,value:overview.members.disabled,icon:LockKeyhole,accent:"muted"},
       {key:"pendingInvites" as const,value:overview.invitations.pending,icon:Clock3,accent:"pending"},
       {key:"failedInvites" as const,value:overview.invitations.failedDelivery,icon:AlertCircle,accent:"alert"}
      ]).map(({key,value,icon:Icon,accent})=><article className={"p22-summary-card p22-summary-"+accent} key={key}>
      <span><Icon size={20}/>{s22(locale,key)}</span>
      <strong>{new Intl.NumberFormat(locale).format(value)}</strong>
     </article>)}</div>
     <div className="p22-roles"><strong>{s22(locale,"roleMix")}</strong>
       <div>{roles.map(role=><span className="p22-role-tile" key={role}>
        <span>{p2(locale,role)}</span><b>{overview.members.byRole[role]}</b></span>)}</div>
     </div>
     {overview.invitations.failedDelivery>0&&<div className="p22-warning">
      <AlertCircle size={18}/>{s22(locale,"invitationAlert")}
      <Link href="/app/staff/invitations">{s22(locale,"seeInvitations")}<ArrowRight size={15}/></Link>
     </div>}
    </>}
  </section>
  {tab!=="permissions"&&<section className="settings-card p22-directory">
   <div className="section-heading"><div><h2>{s22(locale,tab==="directory"?"staffDirectory":"invitationLog")}</h2>
     <p className="muted">{s22(locale,tab==="directory"?"directoryHint":"inviteInstructions")}</p></div>
    <span className="p22-count">{new Intl.NumberFormat(locale).format(total)} {s22(locale,"results")}</span>
   </div>
   <form className="p22-filters" onSubmit={e=>{e.preventDefault();setPage(1);setQuery(searchText.trim());}}>
    <SearchInput label={s22(locale,tab==="directory"?"searchMember":"searchInvitation")}
      clearLabel={s22(locale,"resetFilters")} value={searchText}
      onChange={value=>{setSearchText(value);if(!value){setQuery("");setPage(1);}}}/>
    <FilterSelect label={s22(locale,"role")} options={options} value={roleFilter}
      onChange={value=>changeFilters("role",value)}/>
    <FilterSelect label={s22(locale,"state")} value={statusFilter}
      options={statusOptions} onChange={value=>changeFilters("status",value)}/>
    {tab==="invitations"&&<FilterSelect label={s22(locale,"delivery")} value={deliveryFilter}
      options={[{value:"all",label:s22(locale,"allDeliveries")},
       {value:"sent",label:s22(locale,"statusSent")},
       {value:"failed",label:s22(locale,"statusFailed")},
       {value:"pending",label:s22(locale,"statusSending")}]}
      onChange={value=>changeFilters("delivery",value)}/>}
    <button type="submit" className="button button-small"><Filter size={16}/>{s22(locale,"staffSearch")}</button>
    <button type="button" className="button button-small" disabled={!hasFilters}
      onClick={resetFilters}><RefreshCcw size={16}/>{s22(locale,"resetFilters")}</button>
   </form>
   {tab==="directory"&&<div className="p22-record-list">
    {loading?<LoadingSkeleton rows={3} label={s22(locale,"loading")}/>:
      members?.items.length?members.items.map(person=><article key={person.id} className="p22-member">
       <span className="p22-avatar" aria-hidden="true">{person.name.trim().slice(0,1).toUpperCase()}</span>
       <div className="p22-person"><strong>{person.name}
        {person.userId===workspace.user.id&&<em>{s22(locale,"currentUser")}</em>}</strong>
        <span dir="ltr">{person.email}</span>
        <small>{s22(locale,"created")} · {dateText(person.createdAt,locale)}</small></div>
       <div className="p22-member-info"><Status tone="role">{p2(locale,person.role)}</Status>
        <Status tone={person.status}>{p2(locale,person.status)}</Status></div>
       <div className="p22-member-actions">{canEdit(person)?
        <button type="button" className="button button-small" disabled={busy}
         onClick={()=>startEdit(person)}><UserRoundCog size={16}/>{s22(locale,"edit")}</button>:
        <span className="p22-restricted"><LockKeyhole size={15}/>{s22(locale,"roleProtected")}</span>}</div>
      </article>):<div className="p22-empty"><UsersRound size={30}/>
       <h3>{s22(locale,hasFilters?"emptySearch":"noStaff")}</h3>
       {hasFilters&&<button type="button" className="button" onClick={resetFilters}>{s22(locale,"resetFilters")}</button>}
      </div>}
   </div>}
   {tab==="invitations"&&<div className="p22-record-list">
    {loading?<LoadingSkeleton rows={3} label={s22(locale,"loading")}/>:
     invites?.items.length?invites.items.map(inv=><article key={inv.id} className="p22-member p22-invite">
       <span className="p22-avatar p22-mail" aria-hidden="true"><MailPlus size={21}/></span>
       <div className="p22-person"><strong dir="ltr">{inv.email}</strong>
         <small>{s22(locale,"created")} · {dateText(inv.createdAt,locale)}</small>
         <small>{s22(locale,"inviteExpires")} · {dateText(inv.expiresAt,locale)}
          {" · "}{s22(locale,"sentCount")}: {inv.sendAttempts}</small></div>
       <div className="p22-member-info"><Status tone="role">{p2(locale,inv.role)}</Status>
         <Status tone={inv.status}>{p2(locale,inv.status)}</Status>
         {inv.status==="pending"||inv.status==="expired"?<Status tone={inv.deliveryStatus}>
          {s22(locale,inv.deliveryStatus==="failed"?"statusFailed":inv.deliveryStatus==="sent"?"statusSent":"statusSending")}
         </Status>:null}</div>
       <div className="p22-member-actions">
        {canInvite&&!manager||canInvite&&!["owner","manager"].includes(inv.role)?
         inv.status==="pending"||inv.status==="expired"?<div className="p22-inline-actions">
           <button type="button" className="button button-small" disabled={busy}
            onClick={()=>void inviteAction(inv,"resend")}><Send size={15}/>{s22(locale,"resend")}</button>
           {inv.status==="pending"&&<button type="button" className="button button-small danger-button"
            disabled={busy} onClick={()=>void inviteAction(inv,"revoke")}>
            <X size={15}/>{s22(locale,"revoke")}</button>}
          </div>:<span className="p22-restricted">{s22(locale,"readonly")}</span>:
          <span className="p22-restricted"><LockKeyhole size={15}/>{s22(locale,"readonly")}</span>}
       </div>
     </article>):<div className="p22-empty"><MailPlus size={30}/>
       <h3>{s22(locale,hasFilters?"emptySearch":"noInvites")}</h3>
       {hasFilters&&<button type="button" className="button" onClick={resetFilters}>{s22(locale,"resetFilters")}</button>}
      </div>}
   </div>}
   <PageControls page={page} total={result?.total??0} perPage={10}
     onPageChange={setPage} busy={loading} previousLabel={p2(locale,"previous")}
     nextLabel={p2(locale,"next")} pageLabel={p2(locale,"page")} ofLabel={p2(locale,"of")}/>
  </section>}
  {tab==="invitations"&&<section className="settings-card p22-invite-panel">
   <div className="section-heading"><div><h2>{s22(locale,"inviteForm")}</h2>
    <p className="muted">{s22(locale,"inviteInstructions")}</p></div><MailPlus size={25}/></div>
   {!canInvite?<InlineFeedback tone="info" message={s22(locale,"inviteRestricted")}>
     <Link className="text-link" href="/app/settings/security">{s22(locale,"managerInviteLink")}</Link>
    </InlineFeedback>:<form className="p22-invite-form" onSubmit={e=>void createInvite(e)}>
     <div className="field"><label htmlFor="p22-invite-email">{s22(locale,"email")} *</label>
       <input id="p22-invite-email" type="email" dir="ltr" required maxLength={254}
        autoComplete="off" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
        placeholder="teammate@example.com" disabled={busy}/></div>
     <div className="field"><label htmlFor="p22-invite-role">{s22(locale,"role")} *</label>
       <select id="p22-invite-role" value={inviteRole} disabled={busy}
        onChange={e=>setInviteRole(e.target.value as StaffRole)}>
        {inviteRoles.map(role=><option value={role} key={role}>{p2(locale,role)}</option>)}</select></div>
     <div className="field p22-invite-message"><label htmlFor="p22-invite-message">{s22(locale,"message")}</label>
      <textarea id="p22-invite-message" maxLength={280} rows={2} value={message} disabled={busy}
       onChange={e=>setMessage(e.target.value)}/><small>{s22(locale,"composeNote")}</small></div>
     <div className="p22-form-actions"><span><Clock3 size={17}/>{p2(locale,"inviteExpires")}</span>
      <button type="submit" className="button button-primary" disabled={busy||!inviteEmail.trim()}>
       <MailPlus size={17}/>{busy?s22(locale,"saving"):s22(locale,"sendInvite")}</button></div>
    </form>}
  </section>}
  {tab==="permissions"&&<section className="settings-card p22-permissions">
   <div className="section-heading"><div><h2>{s22(locale,"permissionMatrix")}</h2>
    <p className="muted">{s22(locale,"matrixHelp")}</p></div><ShieldCheck size={24}/></div>
   <div className="p22-policy"><ShieldCheck size={20}/><div>
     <strong>{s22(locale,"invitePolicy")}</strong>
     <p>{overview?.policy.managerCanInvite?s22(locale,"managerInviteOn"):s22(locale,"managerInviteOff")}</p>
    </div>{owner&&<Link href="/app/settings/security" className="button button-small">
     {s22(locale,"managerInviteLink")}<ArrowRight size={15}/></Link>}</div>
   <div className="table-scroll"><table className="data-table p22-permissions-table"><thead><tr>
    <th>{s22(locale,"role")}</th><th>{s22(locale,"capabilityStaff")}</th>
    <th>{s22(locale,"capabilityInvite")}</th><th>{s22(locale,"capabilitySettings")}</th>
    <th>{s22(locale,"capabilityWorkspace")}</th></tr></thead><tbody>
    {roles.map(role=><tr key={role}><th scope="row">{p2(locale,role)}</th>
     <td>{s22(locale,role==="owner"?"capabilityYes":role==="manager"?"capabilityLimited":"capabilityNo")}</td>
     <td>{s22(locale,role==="owner"||role==="manager"&&overview?.policy.managerCanInvite?"capabilityYes":"capabilityNo")}</td>
     <td>{s22(locale,role==="owner"?"capabilityYes":"capabilityNo")}</td>
     <td>{s22(locale,role==="waiter"?"workspaceMobile":role==="kitchen"?"workspaceKitchen":
       role==="cashier"?"workspaceCashier":"workspaceRestaurant")}</td>
    </tr>)}</tbody></table></div>
   <InlineFeedback tone="info" message={s22(locale,"privilegedNote")}/>
   <p className="muted">{s22(locale,"accessRestricted")}</p>
  </section>}
  {editing&&<div className="dialog-backdrop p22-dialog-backdrop" role="presentation"
    onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEditing(null);}}>
   <form ref={editDialogRef} tabIndex={-1} className="dialog-card p22-edit-dialog"
    role="dialog" aria-modal="true" aria-labelledby="p22-edit-title" onSubmit={e=>void updateMember(e)}>
     <div className="p22-dialog-head"><div><span className="eyebrow">DINEFLOW / TEAM</span>
       <h2 id="p22-edit-title">{s22(locale,"editMember")}</h2></div>
      <button type="button" className="icon-action" disabled={busy}
       aria-label={s22(locale,"cancel")} onClick={()=>setEditing(null)}><X size={20}/></button></div>
     <div className="p22-edit-identity"><strong>{editing.name}</strong>
       <span dir="ltr">{editing.email}</span></div>
     <div className="field"><label htmlFor="p22-edit-role">{s22(locale,"role")}</label>
      <select id="p22-edit-role" value={nextRole} disabled={busy}
       onChange={e=>setNextRole(e.target.value as StaffRole)}>
       {roles.filter(role=>owner||!["owner","manager"].includes(role)).map(role=>
         <option key={role} value={role}>{p2(locale,role)}</option>)}</select></div>
     <div className="field"><label htmlFor="p22-edit-status">{s22(locale,"state")}</label>
      <select id="p22-edit-status" value={nextStatus} disabled={busy}
       onChange={e=>setNextStatus(e.target.value as "active"|"disabled")}>
       <option value="active">{p2(locale,"active")}</option>
       <option value="disabled" disabled={editing.userId===workspace.user.id}>{p2(locale,"disabled")}</option></select></div>
     {editing.role==="owner"&&<InlineFeedback tone="info" message={s22(locale,"lastOwner")}/>}
     <div className="p22-dialog-note"><ShieldAlert size={18}/>{s22(locale,"changeWarning")}</div>
     {error&&<p className="form-error" role="alert">{error}</p>}
     <div className="section-actions"><button type="button" className="button" disabled={busy}
       onClick={()=>setEditing(null)}>{s22(locale,"cancel")}</button>
      <button type="submit" className="button button-primary" disabled={busy||!editedDirty}>
       {busy?s22(locale,"saving"):s22(locale,"save")}</button></div>
   </form>
  </div>}
 </div>;
}
