"use client";

import {Search,X,ChevronLeft,ChevronRight,RefreshCw,AlertCircle,Info,CheckCircle2} from "lucide-react";
import type {ChangeEvent,ReactNode} from "react";

export function SearchInput({value,onChange,label,placeholder,clearLabel,className="",disabled=false}:{
  value:string;onChange:(next:string)=>void;label:string;placeholder?:string;clearLabel:string;
  className?:string;disabled?:boolean;
}){
  return <div className={"ds-search-input "+className}>
    <Search size={19} aria-hidden="true"/>
    <input type="search" aria-label={label} placeholder={placeholder??label} value={value}
      disabled={disabled} onChange={(event:ChangeEvent<HTMLInputElement>)=>onChange(event.target.value)}/>
    {value.length>0&&<button type="button" className="ds-search-clear" disabled={disabled}
      onClick={()=>onChange("")} title={clearLabel} aria-label={clearLabel}><X size={17}/></button>}
  </div>;
}
export type FilterOption={value:string;label:string};
export function FilterSelect({value,onChange,label,options,disabled=false,className=""}:{
  value:string;onChange:(value:string)=>void;label:string;options:readonly FilterOption[];
  disabled?:boolean;className?:string;
}){
  return <select className={"ds-filter-select "+className} value={value}
    aria-label={label} disabled={disabled} onChange={event=>onChange(event.target.value)}>
    {options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}
export function PageControls({page,total,perPage,onPageChange,previousLabel,nextLabel,
  pageLabel,ofLabel,busy=false,className=""}:{
  page:number;total:number;perPage:number;onPageChange:(next:number)=>void;
  previousLabel:string;nextLabel:string;pageLabel:string;ofLabel:string;busy?:boolean;className?:string;
}){
  const pages=Math.max(1,Math.ceil(Math.max(0,total)/Math.max(1,perPage)));
  if(total<=perPage)return null;
  return <nav className={"ds-page-controls "+className}
      aria-label={pageLabel} aria-busy={busy}>
    <button type="button" className="button button-small" aria-label={previousLabel}
      disabled={busy||page<=1} onClick={()=>onPageChange(Math.max(1,page-1))}>
      <ChevronLeft size={16} aria-hidden="true"/>{previousLabel}
    </button>
    <span className="ds-page-location" aria-live="polite">
      {pageLabel} <strong>{Math.min(page,pages)}</strong> {ofLabel} <strong>{pages}</strong>
    </span>
    <button type="button" className="button button-small" aria-label={nextLabel}
      disabled={busy||page>=pages} onClick={()=>onPageChange(Math.min(pages,page+1))}>
      {nextLabel}<ChevronRight size={16} aria-hidden="true"/>
    </button>
  </nav>;
}
export function InlineFeedback({message,tone="error",retry,onRetryLabel,children}:{
  message:string;tone?:"error"|"success"|"info";retry?:()=>void;onRetryLabel?:string;children?:ReactNode;
}){
  const Icon=tone==="error"?AlertCircle:tone==="success"?CheckCircle2:Info;
  return <div className={"ds-inline-feedback ds-inline-"+tone}
      role={tone==="error"?"alert":"status"}>
    <Icon size={18} aria-hidden="true"/>
    <span>{message}</span>
    {children}
    {retry&&<button className="button button-small" type="button" onClick={retry}>
      <RefreshCw size={15} aria-hidden="true"/>{onRetryLabel??"Retry"}
    </button>}
  </div>;
}
