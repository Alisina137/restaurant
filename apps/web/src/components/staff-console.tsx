"use client";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardList, MailPlus, ShieldCheck, UserRoundCog, UsersRound, RefreshCw } from "lucide-react";
import { type StaffRole } from "@dineflow/shared";
import { useWorkspace } from "@/components/workspace-provider";
import { jsonRequest, type PageResult } from "@/lib/phase2-api";
import { p2 } from "@/lib/phase2-copy";
import {useInteraction} from "./ui/interaction-provider";
import {useDialogFocus} from "./ui/use-dialog-focus";
import {InlineFeedback,PageControls} from "./ui/interaction-controls";
import {LoadingSkeleton} from "./ui/design-system";

const roles: StaffRole[] = ["owner","manager","waiter","kitchen","cashier"];
type Member = { id:string;userId:string;name:string;email:string;role:StaffRole;status:"active"|"disabled";createdAt:string };
type Invite = {id:string;email:string;role:StaffRole;status:"pending"|"accepted"|"expired"|"revoked";deliveryStatus:"pending"|"sent"|"failed";expiresAt:string;createdAt:string};
type Tab = "directory" | "invitations" | "permissions";
function localizedDate(value:string,locale:string){return new Date(value).toLocaleDateString(locale,{year:"numeric",month:"short",day:"numeric"});}
export function StaffConsole({tab}:{tab:Tab}){
  const {workspace}=useWorkspace(), locale=workspace.locale;
  const {confirm,notify}=useInteraction();
  const actionLock=useRef(false);
  const [members,setMembers]=useState<PageResult<Member>|null>(null),[invites,setInvites]=useState<PageResult<Invite>|null>(null),
    [page,setPage]=useState(1),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [inviteEmail,setInviteEmail]=useState(""),[inviteRole,setInviteRole]=useState<StaffRole>("waiter"),[message,setMessage]=useState("");
  const [editing,setEditing]=useState<Member|null>(null),[nextRole,setNextRole]=useState<StaffRole>("waiter"),[nextStatus,setNextStatus]=useState<"active"|"disabled">("active");
  const editDialogRef=useDialogFocus<HTMLFormElement>(!!editing,()=>{if(!busy)setEditing(null);});
  useEffect(()=>{if(notice){notify(notice,"success");setNotice("");}},[notice,notify]);
  const load=useCallback(async()=>{
    if(tab==="permissions"){setLoading(false);return;}
    setLoading(true);setError("");
    try{
      if(tab==="directory")setMembers(await jsonRequest<PageResult<Member>>("/api/tenant/staff?page="+page));
      if(tab==="invitations")setInvites(await jsonRequest<PageResult<Invite>>("/api/tenant/invitations?page="+page));
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}
    finally{setLoading(false);}
  },[page,tab,locale]);
  useEffect(()=>{void load();},[load]);
  const tabItems=[{key:"directory",label:"directory",icon:UsersRound},{key:"invitations",label:"invitations",icon:MailPlus},
    {key:"permissions",label:"permissions",icon:ShieldCheck}] as const;
  function canEdit(member:Member){
    if(workspace.role==="owner")return true;
    return (member.role==="waiter"||member.role==="kitchen"||member.role==="cashier") && member.userId!==workspace.user.id;
  }
  function startEdit(item:Member){setEditing(item);setNextRole(item.role);setNextStatus(item.status);setError("");setNotice("");}
  async function updateMember(e:FormEvent){
    e.preventDefault();if(!editing||actionLock.current)return;actionLock.current=true;setBusy(true);setError("");setNotice("");
    try{await jsonRequest("/api/tenant/staff/"+editing.id,{method:"PATCH",body:JSON.stringify({role:nextRole,status:nextStatus})});
      setEditing(null);setNotice(p2(locale,"saveSuccess"));await load();}
    catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}finally{actionLock.current=false;setBusy(false);}
  }
  async function createInvite(e:FormEvent){
    e.preventDefault();if(actionLock.current)return;actionLock.current=true;setBusy(true);setError("");setNotice("");
    try{
      const response=await jsonRequest<{deliveryStatus:string;message:string}>("/api/tenant/invitations",
        {method:"POST",body:JSON.stringify({email:inviteEmail,role:inviteRole,message})});
      setInviteEmail("");setMessage("");
      if(response.deliveryStatus==="sent")setNotice(p2(locale,"invitationSent"));
      else notify(p2(locale,"invitationFailed"),"error");
      setPage(1);await load();
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}
    finally{actionLock.current=false;setBusy(false);}
  }
  async function actInvite(id:string,action:"resend"|"revoke"){
    if(actionLock.current)return;
    if(action==="revoke"&&!(await confirm({title:p2(locale,"revoke"),description:p2(locale,"confirmRevoke"),
      confirmLabel:p2(locale,"revoke"),cancelLabel:p2(locale,"cancel"),danger:true})))return;
    if(actionLock.current)return;actionLock.current=true;setBusy(true);setError("");setNotice("");
    try{const result=await jsonRequest<{deliveryStatus?:string}>("/api/tenant/invitations/"+id+"/"+action,
        {method:"POST",body:"{}"});
      if(result.deliveryStatus==="failed")notify(p2(locale,"invitationFailed"),"error");
      else setNotice(p2(locale,"saveSuccess"));
      await load();
    }catch(e){setError(e instanceof Error?e.message:p2(locale,"error"));}
    finally{actionLock.current=false;setBusy(false);}
  }
  return <div className="content-stack">
    <div className="page-heading"><div><div className="eyebrow">{p2(locale,"restaurant")} / {p2(locale,"team")}</div>
      <h1>{p2(locale,"team")}</h1><p>{p2(locale,"staffHelp")}</p></div>
      {tab==="directory"&&<Link className="button button-primary" href="/app/staff/invitations"><MailPlus size={18}/>{p2(locale,"invite")}</Link>}</div>
    <nav className="context-tabs" aria-label={p2(locale,"team")}>{tabItems.map(({key,label,icon:Icon})=>
      <Link key={key} href={"/app/staff/"+key} aria-current={tab===key?"page":undefined} className={"context-tab"+(tab===key?" current":"")}>
        <Icon size={18}/>{p2(locale,label)}</Link>)}</nav>
    {error&&<InlineFeedback message={error} retry={()=>void load()} onRetryLabel={p2(locale,"retry")}/>}
    {tab==="directory"&&<section className="settings-card">
      <div className="section-heading"><div><h2>{p2(locale,"directory")}</h2>
        <p className="muted">{members?.total??"—"} {p2(locale,"staffCount")}</p></div>
        <button type="button" className="button" onClick={()=>void load()} aria-label={p2(locale,"refresh")}><RefreshCw size={18}/></button></div>
      {loading?<LoadingSkeleton rows={3} label={p2(locale,"loading")}/>:members?.items.length?
        <div className="table-scroll"><table className="data-table"><thead><tr>
          <th>{p2(locale,"fullName")}</th><th>{p2(locale,"role")}</th><th>{p2(locale,"status")}</th>
          <th>{p2(locale,"createdAt")}</th><th>{p2(locale,"edit")}</th></tr></thead><tbody>
          {members.items.map(item=><tr key={item.id}><td><strong>{item.name}</strong><div className="muted" dir="ltr">{item.email}</div></td>
            <td>{p2(locale,item.role)}</td><td><span className={"data-badge "+item.status}>{p2(locale,item.status)}</span></td>
            <td>{localizedDate(item.createdAt,locale)}</td>
            <td>{canEdit(item)?<button className="button button-small" type="button" onClick={()=>startEdit(item)}>
              <UserRoundCog size={15}/>{p2(locale,"edit")}</button>:<span className="muted">—</span>}</td></tr>)}
        </tbody></table></div>:<div className="empty-panel"><UsersRound size={28}/><h3>{p2(locale,"noStaff")}</h3>
          <Link className="button button-primary" href="/app/staff/invitations">{p2(locale,"invite")}</Link></div>}
      <Pager page={page} total={members?.total??0} locale={locale} change={setPage}/>
    </section>}
    {tab==="invitations"&&<>
      <form className="settings-card" onSubmit={e=>void createInvite(e)}>
        <div className="section-heading"><div><h2>{p2(locale,"inviteNew")}</h2><p className="muted">{p2(locale,"invitationsHelp")}</p></div>
          <MailPlus size={24} color="var(--brand)"/></div>
        <div className="form-grid"><div className="field"><label htmlFor="invite-email">{p2(locale,"email")}</label>
            <input id="invite-email" type="email" dir="ltr" autoComplete="off" required value={inviteEmail}
              onChange={e=>setInviteEmail(e.target.value)} placeholder="teammate@example.com"/></div>
          <div className="field"><label htmlFor="invite-role">{p2(locale,"role")}</label>
            <select id="invite-role" value={inviteRole} onChange={e=>setInviteRole(e.target.value as StaffRole)}>
              {roles.filter(role=>workspace.role==="owner"||!["owner","manager"].includes(role)).map(role=>
                <option key={role} value={role}>{p2(locale,role)}</option>)}</select></div>
          <div className="field form-span"><label htmlFor="invite-note">{p2(locale,"message")}</label>
            <input id="invite-note" maxLength={280} value={message} onChange={e=>setMessage(e.target.value)}/></div></div>
        <div className="section-actions"><span className="muted">{p2(locale,"inviteExpires")}</span>
          <button className="button button-primary" type="submit" disabled={busy}><MailPlus size={18}/>{busy?p2(locale,"loading"):p2(locale,"sendInvite")}</button></div>
      </form>
      <section className="settings-card"><div className="section-heading"><h2>{p2(locale,"invitations")}</h2>
        <button className="button" type="button" aria-label={p2(locale,"refresh")} onClick={()=>void load()}><RefreshCw size={18}/></button></div>
        {loading?<LoadingSkeleton rows={3} label={p2(locale,"loading")}/>:invites?.items.length?
          <div className="table-scroll"><table className="data-table"><thead><tr>
            <th>{p2(locale,"email")}</th><th>{p2(locale,"role")}</th><th>{p2(locale,"status")}</th>
            <th>{p2(locale,"createdAt")}</th><th>{p2(locale,"details")}</th></tr></thead><tbody>
              {invites.items.map(item=><tr key={item.id}>
                <td><bdi>{item.email}</bdi></td><td>{p2(locale,item.role)}</td>
                <td><span className={"data-badge "+item.status}>{p2(locale,item.status)}</span>
                  {item.deliveryStatus==="failed"&&<span className="data-badge disabled">{p2(locale,"failed")}</span>}</td>
                <td>{localizedDate(item.createdAt,locale)}</td>
                <td>{item.status==="pending"?(workspace.role==="manager"&&["owner","manager"].includes(item.role)?"—":
                  <div className="inline-actions"><button className="button button-small" disabled={busy} onClick={()=>void actInvite(item.id,"resend")} type="button">{p2(locale,"resend")}</button>
                    <button className="button button-small danger-button" disabled={busy} onClick={()=>void actInvite(item.id,"revoke")} type="button">{p2(locale,"revoke")}</button></div>):"—"}</td>
              </tr>)}</tbody></table></div>:<div className="empty-panel"><MailPlus size={28}/><h3>{p2(locale,"noInvitations")}</h3></div>}
        <Pager page={page} total={invites?.total??0} locale={locale} change={setPage}/>
      </section></>}
    {tab==="permissions"&&<section className="settings-card">
      <div className="section-heading"><div><h2>{p2(locale,"rolePermissions")}</h2><p className="muted">{p2(locale,"managerInviteHelp")}</p></div><ShieldCheck size={25} color="var(--brand)"/></div>
      <div className="permission-grid"><div className="permission-header">{p2(locale,"role")}</div>
        <div className="permission-header">{p2(locale,"viewPermission")}</div>
        <div className="permission-header">{p2(locale,"manageStaff")}</div>
        <div className="permission-header">{p2(locale,"manageRestaurant")}</div>
        {roles.map(role=><div className="permission-row" key={role}>
          <strong>{p2(locale,role)}</strong><span>✓</span><span>{role==="owner"||role==="manager"?"✓":"—"}</span>
          <span>{role==="owner"?"✓":role==="manager"?"Limited":"—"}</span></div>)}</div>
      {workspace.role==="owner"&&<Link className="text-link" href="/app/settings/security">{p2(locale,"security")}</Link>}
      <div className="muted" role="note">{p2(locale,"support")}</div>
    </section>}
    {editing&&<div className="dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}>
      <form ref={editDialogRef} tabIndex={-1} className="dialog-card" onSubmit={e=>void updateMember(e)} role="dialog" aria-modal="true" aria-labelledby="edit-member-title">
        <h2 id="edit-member-title">{p2(locale,"edit")} — {editing.name}</h2><p className="muted"><bdi>{editing.email}</bdi></p>
        <div className="field"><label htmlFor="edit-member-role">{p2(locale,"role")}</label>
          <select id="edit-member-role" value={nextRole} onChange={e=>setNextRole(e.target.value as StaffRole)}>
            {roles.filter(role=>workspace.role==="owner"||!["owner","manager"].includes(role)).map(role=>
              <option key={role} value={role}>{p2(locale,role)}</option>)}</select></div>
        <div className="field"><label htmlFor="edit-member-status">{p2(locale,"status")}</label>
          <select id="edit-member-status" value={nextStatus} onChange={e=>setNextStatus(e.target.value as "active"|"disabled")}>
            <option value="active">{p2(locale,"active")}</option><option value="disabled">{p2(locale,"disabled")}</option></select></div>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="section-actions"><button type="button" className="button" disabled={busy} onClick={()=>setEditing(null)}>{p2(locale,"cancel")}</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy?p2(locale,"loading"):p2(locale,"save")}</button></div>
      </form></div>}
  </div>;
}
function Pager({page,total,locale,change}:{page:number;total:number;locale:"fa-AF"|"ps-AF"|"en";change:(x:number)=>void}){
  return <PageControls page={page} total={total} perPage={10} onPageChange={change}
    previousLabel={p2(locale,"previous")} nextLabel={p2(locale,"next")}
    pageLabel={p2(locale,"page")} ofLabel={p2(locale,"of")}/>;
}
