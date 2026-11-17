"use client";
import {type FormEvent,useState} from "react";
import {Check,DoorOpen,Save,X,UsersRound} from "lucide-react";
import type {Locale} from "@dineflow/shared";
import {f4} from "@/lib/floor-copy";
import {f21} from "@/lib/floor21-copy";
import type {DiningTable,Section,Waiter} from "@/lib/floor-types";

type Common={locale:Locale;busy:boolean;close:()=>void;save:(data:Record<string,unknown>)=>Promise<void>};
function Head({title,close,locale,busy}:{title:string;close:()=>void;locale:Locale;busy:boolean}){
 return <div className="floor-dialog-head"><h2 id="floor-modal-title">{title}</h2>
  <button type="button" className="icon-action" aria-label={f4(locale,"close")} disabled={busy} onClick={close}><X size={22}/></button></div>;
}
function Actions({locale,busy,close,create}:{locale:Locale;busy:boolean;close:()=>void;create:boolean}){
 return <footer className="floor-dialog-actions"><button type="button" className="button" disabled={busy} onClick={close}>{f4(locale,"cancel")}</button>
  <button type="submit" disabled={busy} className="button button-primary"><Save size={18}/>{busy?f4(locale,"saving"):f4(locale,create?"create":"save")}</button></footer>;
}
export function SectionForm({locale,busy,close,save,initial}:{initial?:Section}&Common){
 const [name,setName]=useState(initial?.name??""),[sort,setSort]=useState(initial?.sortOrder??0);
 const [active,setActive]=useState(initial?.active??true);
 function submit(e:FormEvent){e.preventDefault();void save({name,sortOrder:sort,active,...(initial?{version:initial.version}:{})});}
 return <form className="floor-dialog-body" onSubmit={submit}>
  <Head title={f4(locale,initial?"editSection":"newSection")} close={close} locale={locale} busy={busy}/>
  <label className="field"><span>{f4(locale,"sectionName")} *</span><input value={name} required minLength={2} maxLength={40} onChange={e=>setName(e.target.value)}/></label>
  <label className="field"><span>{f4(locale,"displayOrder")}</span><input type="number" min={-9999} max={9999} value={sort}
   onChange={e=>setSort(Number(e.target.value))}/></label>
  <p className="p21-form-note">{f21(locale,"sectionHint")}</p>
  <label className="menu-check"><input type="checkbox" checked={active}
     onChange={e=>setActive(e.target.checked)}/>{f4(locale,"active")}</label>
  <Actions locale={locale} busy={busy} close={close} create={!initial}/></form>;
}
export function TableForm({locale,busy,close,save,initial,sections,waiters}:{initial?:DiningTable;sections:Section[];waiters:Waiter[]}&Common){
 const [label,setLabel]=useState(initial?.label??""),[sectionId,setSectionId]=useState(initial?.sectionId??sections.find(s=>s.active)?.id??"");
 const [seats,setSeats]=useState(initial?.seats??4),[sort,setSort]=useState(initial?.sortOrder??0);
 const [notes,setNotes]=useState(initial?.notes??""),[active,setActive]=useState(initial?.active??true);
 const [waiter,setWaiter]=useState(initial?.assignedWaiterId??"");
 const occupied=initial?.status==="occupied";
 const options=sections.filter(s=>s.active||s.id===initial?.sectionId);
 function submit(e:FormEvent){e.preventDefault();void save({label,sectionId,seats,sortOrder:sort,notes,active,
  assignedWaiterId:waiter||null,...(initial?{version:initial.version}:{})});}
 return <form className="floor-dialog-body" onSubmit={submit}>
  <Head title={f4(locale,initial?"editTable":"newTable")} close={close} locale={locale} busy={busy}/>
  <div className="floor-field-grid">
   <label className="field"><span>{f4(locale,"tableLabel")} *</span><input value={label} required maxLength={12}
     onChange={e=>setLabel(e.target.value)}/></label>
   <label className="field"><span>{f4(locale,"section")} *</span><select value={sectionId} required disabled={occupied} onChange={e=>setSectionId(e.target.value)}>
     <option value="">{f4(locale,"selectSection")}</option>{options.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
   <label className="field"><span>{f4(locale,"seats")}</span><input type="number" min={1} max={30} required value={seats}
     onChange={e=>setSeats(Number(e.target.value))}/></label>
   <label className="field"><span>{f4(locale,"displayOrder")}</span><input type="number" min={-9999} max={9999} value={sort}
     onChange={e=>setSort(Number(e.target.value))}/></label>
   <label className="field floor-full"><span>{f4(locale,"assigned")}</span><select value={waiter} onChange={e=>setWaiter(e.target.value)}>
     <option value="" disabled={occupied}>{f4(locale,"unassigned")}</option>{waiters.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
     {!waiters.length&&<small className="muted">{f4(locale,"noStaff")}</small>}</label>
   <label className="field floor-full"><span>{f4(locale,"notes")}</span>
     <textarea rows={2} maxLength={240} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
  </div>
  {occupied&&<p className="floor-hint">{f21(locale,"tableBlocked")}</p>}
  <label className="menu-check"><input type="checkbox" checked={active} disabled={occupied}
    onChange={e=>setActive(e.target.checked)}/>{f4(locale,"active")}</label>
  <Actions locale={locale} busy={busy} close={close} create={!initial}/></form>;
}
export function VisitForm({locale,busy,close,save,table,manager}:{table:DiningTable;manager:boolean}&Common){
 const [partySize,setPartySize]=useState(Math.min(table.seats,2));
 function submit(e:FormEvent){e.preventDefault();void save({partySize});}
 return <form className="floor-dialog-body" onSubmit={submit}>
  <Head title={f4(locale,"openVisit")+" · "+table.label} close={close} locale={locale} busy={busy}/>
  <div className="floor-dialog-highlight"><UsersRound size={21}/><span>{f4(locale,"capacity")}: <strong>{table.seats}</strong></span></div>
  <label className="field"><span>{f4(locale,"partySize")} *</span><input type="number" min={1} max={30} required value={partySize}
    onChange={e=>setPartySize(Number(e.target.value))}/></label>
  {partySize>table.seats&&<p className="floor-hint">{f21(locale,"capacityWarn")}</p>}
  <p className="muted">{f4(locale,"assigned")}: {table.assignedWaiterName??f4(locale,"unassigned")}</p>
  <footer className="floor-dialog-actions"><button type="button" className="button" disabled={busy} onClick={close}>{f4(locale,"cancel")}</button>
    <button type="submit" disabled={busy||!table.assignedWaiterId||partySize>30||partySize<1||(!manager&&partySize>table.seats)} className="button button-primary"><DoorOpen size={18}/>{busy?f4(locale,"saving"):f4(locale,"openConfirm")}</button></footer>
 </form>;
}
export function FinishForm({locale,busy,close,save,table}:{table:DiningTable}&Common){
 const [reason,setReason]=useState("");
 function submit(e:FormEvent){e.preventDefault();void save({reason});}
 return <form className="floor-dialog-body" onSubmit={submit}>
  <Head title={f4(locale,"finish")+" · "+table.label} close={close} locale={locale} busy={busy}/>
  <p className="floor-hint">{f21(locale,"finishWarn")}</p>
  <label className="field"><span>{f4(locale,"finishReason")} *</span><textarea required minLength={5} maxLength={160}
    rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
  <footer className="floor-dialog-actions"><button type="button" className="button" disabled={busy} onClick={close}>{f4(locale,"cancel")}</button>
   <button type="submit" className="button button-primary" disabled={busy}><Check size={18}/>{f4(locale,"finishConfirm")}</button></footer>
 </form>;
}
