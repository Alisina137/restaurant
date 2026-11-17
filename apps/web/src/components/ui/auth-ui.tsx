"use client";

import {useEffect,useState,type ChangeEvent} from "react";
import {Eye,EyeOff,LockKeyhole} from "lucide-react";
import {direction,isLocale,type Locale} from "@dineflow/shared";
import {au} from "@/lib/auth-ux-copy";

export function useAuthLocale(){
  const [locale,setLocale]=useState<Locale>("fa-AF");
  useEffect(()=>{
    try{const saved=localStorage.getItem("dineflow-locale");if(isLocale(saved))setLocale(saved);}catch{}
  },[]);
  useEffect(()=>{
    document.documentElement.lang=locale;
    document.documentElement.dir=direction(locale);
    try{localStorage.setItem("dineflow-locale",locale);}catch{}
  },[locale]);
  return {locale,setLocale};
}
export function AuthLanguage({locale,onChange,id="auth-language"}:{
  locale:Locale;onChange:(next:Locale)=>void;id?:string;
}){
  return <label className="p18-language-control" htmlFor={id}>
    <span className="sr-only">Language / زبان / ژبه</span>
    <select id={id} className="language-select" value={locale}
      onChange={e=>onChange(e.target.value as Locale)}>
      <option value="fa-AF">دری</option><option value="ps-AF">پښتو</option>
      <option value="en">English</option>
    </select>
  </label>;
}
export function PasswordField({id,label,value,onChange,locale,autoComplete="new-password",hint,error,
  minLength=12,required=true}:{
  id:string;label:string;value:string;onChange:(value:string)=>void;locale:Locale;
  autoComplete?:"current-password"|"new-password";hint?:string;error?:string;minLength?:number;required?:boolean;
}){
  const [visible,setVisible]=useState(false);
  return <div className="field p18-password-field">
    <label htmlFor={id}>{label}</label>
    <div className="p18-password-shell">
      <LockKeyhole size={17} aria-hidden="true"/>
      <input id={id} name={id} type={visible?"text":"password"} value={value}
        onChange={(e:ChangeEvent<HTMLInputElement>)=>onChange(e.target.value)}
        autoComplete={autoComplete} required={required} minLength={minLength} maxLength={128}
        aria-invalid={!!error} aria-describedby={[hint?id+"-hint":null,error?id+"-error":null].filter(Boolean).join(" ")||undefined}/>
      <button type="button" className="p18-password-toggle"
        aria-label={au(locale,visible?"hidePassword":"showPassword")}
        title={au(locale,visible?"hidePassword":"showPassword")}
        aria-pressed={visible} onClick={()=>setVisible(p=>!p)}>
        {visible?<EyeOff size={18} aria-hidden="true"/>:<Eye size={18} aria-hidden="true"/>}
      </button>
    </div>
    {hint&&<p className="ds-hint" id={id+"-hint"}>{hint}</p>}
    {error&&<p className="ds-field-error" id={id+"-error"} role="alert">{error}</p>}
  </div>;
}
export function AuthSteps({current,labels}:{
 current:number;labels:readonly string[];
}){
  return <ol className="p18-auth-steps" aria-label="Setup progress">
    {labels.map((name,i)=><li key={name} className={i<current?"done":i===current?"current":""}
      aria-current={i===current?"step":undefined}>
      <span className="p18-step-number">{i+1}</span><span>{name}</span>
    </li>)}
  </ol>;
}
