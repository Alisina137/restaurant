"use client";

import {useEffect,useRef} from "react";

/** Focus trap for an existing form or panel. Keep hooks unconditional, even when closed. */
export function useDialogFocus<T extends HTMLElement>(open:boolean,onRequestClose:()=>void){
  const ref=useRef<T|null>(null);
  const closeRef=useRef(onRequestClose);
  useEffect(()=>{closeRef.current=onRequestClose;},[onRequestClose]);
  useEffect(()=>{
    if(!open)return;
    const target=ref.current;
    if(!target)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const focusable=()=>Array.from(target.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter(el=>el.getClientRects().length>0);
    (focusable()[0]??target).focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();closeRef.current();return;}
      if(event.key!=="Tab")return;
      const nodes=focusable(),first=nodes[0],last=nodes[nodes.length-1];
      if(!first||!last)return;
      if(event.shiftKey&&(document.activeElement===first||!target.contains(document.activeElement))){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&(document.activeElement===last||!target.contains(document.activeElement))){
        event.preventDefault();first.focus();
      }
    };
    window.addEventListener("keydown",onKey);
    return()=>{
      window.removeEventListener("keydown",onKey);
      document.body.style.overflow=oldOverflow;
      if(previous?.isConnected)previous.focus();
    };
  },[open]);
  return ref;
}
