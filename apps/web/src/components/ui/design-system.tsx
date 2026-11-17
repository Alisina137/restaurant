import type {ButtonHTMLAttributes, HTMLAttributes, ReactNode} from "react";

function classes(...values:(string|undefined|false)[]){return values.filter(Boolean).join(" ");}

export function Surface({children,className,...props}:HTMLAttributes<HTMLElement>){
  return <section {...props} className={classes("settings-card","ds-surface",className)}>{children}</section>;
}
export function SurfaceHeading({title,description,action}:{
  title:string;description?:string;action?:ReactNode;
}){
  return <div className="ds-surface-header">
    <div><h2 className="ds-surface-title">{title}</h2>{description&&<p className="ds-surface-subtitle">{description}</p>}</div>
    {action}
  </div>;
}
export function StatusBadge({tone="neutral",className,children}:{
  tone?:"success"|"warning"|"danger"|"info"|"neutral";className?:string;children:ReactNode;
}){
  return <span className={classes("ds-badge","ds-badge-"+tone,className)}>{children}</span>;
}
export function LoadingSkeleton({rows=3,label,className}:{
  rows?:number;label:string;className?:string;
}){
  return <div role="status" aria-label={label} className={classes("ds-skeleton",className)}>
    {Array.from({length:Math.min(10,Math.max(1,Math.floor(rows)))},(_,i)=><span key={i} aria-hidden="true"/>)}
  </div>;
}
export function EmptyState({icon,title,description,action,className}:{
  icon?:ReactNode;title:string;description?:string;action?:ReactNode;className?:string;
}){
  return <div className={classes("ds-empty-state",className)}>
    {icon&&<span aria-hidden="true">{icon}</span>}
    <h3>{title}</h3>{description&&<p>{description}</p>}{action}
  </div>;
}
export function ActionButton({variant="secondary",loading=false,loadingText,className,disabled,children,...props}:
  ButtonHTMLAttributes<HTMLButtonElement>&{
    variant?:"primary"|"secondary"|"danger";loading?:boolean;loadingText?:string;
  }){
  return <button {...props} disabled={disabled||loading} aria-busy={loading||undefined}
    className={classes("button","ds-button",variant==="primary"?"button-primary":variant==="danger"?"ds-button-danger":"",className)}>
    {loading&&<span className="button-spinner" aria-hidden="true"/>}
    {loading&&loadingText?loadingText:children}
  </button>;
}
export function FormField({id,label,hint,error,children,className}:{
  id:string;label:string;hint?:string;error?:string;children:ReactNode;className?:string;
}){
  return <div className={classes("field",className)}>
    <label htmlFor={id}>{label}</label>
    {children}
    {hint&&<p className="ds-hint" id={id+"-hint"}>{hint}</p>}
    {error&&<p className="ds-field-error" id={id+"-error"} role="alert">{error}</p>}
  </div>;
}
