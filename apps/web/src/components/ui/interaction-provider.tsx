"use client";

import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {AlertCircle,CheckCircle2,Info,X} from "lucide-react";

export type FeedbackTone="success"|"error"|"info";
export type Confirmation={title:string;description?:string;confirmLabel:string;cancelLabel:string;danger?:boolean};
type Notification={id:number;message:string;tone:FeedbackTone};
type FeedbackApi={notify:(message:string,tone?:FeedbackTone)=>void;confirm:(options:Confirmation)=>Promise<boolean>};
const FeedbackContext=createContext<FeedbackApi|null>(null);

function closeCopy(){
  const locale=typeof document!=="undefined"?document.documentElement.lang:"en";
  return locale==="ps-AF"?"بندول":locale==="fa-AF"?"بستن":"Dismiss";
}
export function InteractionProvider({children}:{children:ReactNode}){
  const [toasts,setToasts]=useState<Notification[]>([]);
  const [dialog,setDialog]=useState<Confirmation|null>(null);
  const nextId=useRef(0);
  const timers=useRef<Map<number,ReturnType<typeof setTimeout>>>(new Map());
  const pending=useRef<((accepted:boolean)=>void)|null>(null);
  const dialogRef=useRef<HTMLDivElement|null>(null);

  const dismiss=useCallback((id:number)=>{
    const timer=timers.current.get(id);
    if(timer)clearTimeout(timer);
    timers.current.delete(id);
    setToasts(prev=>prev.filter(item=>item.id!==id));
  },[]);
  const notify=useCallback((message:string,tone:FeedbackTone="success")=>{
    if(!message.trim())return;
    const id=++nextId.current;
    setToasts(prev=>[...prev.filter(item=>!(item.message===message&&item.tone===tone)),{id,message,tone}].slice(-3));
    timers.current.set(id,setTimeout(()=>dismiss(id),5000));
  },[dismiss]);
  const confirm=useCallback((options:Confirmation):Promise<boolean>=>{
    if(pending.current)return Promise.resolve(false); // Never replace an unanswered confirmation.
    return new Promise(resolve=>{pending.current=resolve;setDialog(options);});
  },[]);
  const settle=useCallback((accepted:boolean)=>{
    const resolve=pending.current;
    pending.current=null;
    setDialog(null);
    resolve?.(accepted);
  },[]);

  useEffect(()=>{
    const timeouts=timers.current;
    return()=>{
      for(const timer of timeouts.values())clearTimeout(timer);
      timeouts.clear();
      const unresolved=pending.current;
      pending.current=null;
      unresolved?.(false);
    };
  },[]);
  useEffect(()=>{
    if(!dialog)return;
    const oldOverflow=document.body.style.overflow;
    const before=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.body.style.overflow="hidden";
    const focusable=()=>Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")??[]);
    focusable()[0]?.focus();
    function onKey(event:KeyboardEvent){
      if(event.key==="Escape"){event.preventDefault();settle(false);return;}
      if(event.key!=="Tab")return;
      const controls=focusable(),first=controls[0],last=controls[controls.length-1];
      if(!first||!last)return;
      if(event.shiftKey&&(document.activeElement===first||!dialogRef.current?.contains(document.activeElement))){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&(document.activeElement===last||!dialogRef.current?.contains(document.activeElement))){
        event.preventDefault();first.focus();
      }
    }
    window.addEventListener("keydown",onKey);
    return()=>{
      document.body.style.overflow=oldOverflow;
      window.removeEventListener("keydown",onKey);
      if(before?.isConnected)before.focus();
    };
  },[dialog,settle]);

  return <FeedbackContext.Provider value={{notify,confirm}}>
    {children}
    <div className="df-toast-stack" aria-label="Notifications">
      {toasts.map(toast=>{
        const Icon=toast.tone==="success"?CheckCircle2:toast.tone==="error"?AlertCircle:Info;
        return <div key={toast.id} className={"df-toast df-toast-"+toast.tone}
          role={toast.tone==="error"?"alert":"status"}>
          <Icon size={19} aria-hidden="true"/>
          <span>{toast.message}</span>
          <button type="button" aria-label={closeCopy()} title={closeCopy()}
            onClick={()=>dismiss(toast.id)}><X size={17}/></button>
        </div>;
      })}
    </div>
    {dialog&&<div className="df-confirm-backdrop"
      onMouseDown={event=>{if(event.currentTarget===event.target)settle(false);}}>
      <div ref={dialogRef} className="df-confirm-dialog"
        role={dialog.danger?"alertdialog":"dialog"} aria-modal="true"
        aria-labelledby="df-confirm-title" aria-describedby={dialog.description?"df-confirm-description":undefined}>
        <span className={"df-confirm-icon"+(dialog.danger?" is-danger":"")}>
          <AlertCircle size={23} aria-hidden="true"/>
        </span>
        <h2 id="df-confirm-title">{dialog.title}</h2>
        {dialog.description&&<p id="df-confirm-description">{dialog.description}</p>}
        <div className="df-confirm-actions">
          <button type="button" className="button" onClick={()=>settle(false)}>{dialog.cancelLabel}</button>
          <button type="button" className={"button "+(dialog.danger?"ds-button-danger":"button-primary")}
            onClick={()=>settle(true)}>{dialog.confirmLabel}</button>
        </div>
      </div>
    </div>}
  </FeedbackContext.Provider>;
}
export function useInteraction(){
  const context=useContext(FeedbackContext);
  if(!context)throw new Error("InteractionProvider is required");
  return context;
}
