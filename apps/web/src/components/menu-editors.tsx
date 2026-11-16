"use client";
import { type FormEvent, useState } from "react";
import { ImagePlus, Plus, Trash2, UploadCloud, X, CheckCircle2 } from "lucide-react";
import { type Locale } from "@dineflow/shared";
import { API_URL } from "@/lib/auth-client";
import { m3 } from "@/lib/menu-copy";
import { allergens, moneyInput, parseMoney, type Category, type Group, type ItemDetail } from "@/lib/menu-types";
type Finish=(payload:Record<string,unknown>)=>Promise<void>;
type Common={locale:Locale;busy:boolean;close:()=>void;submit:Finish};
function Names({value,update,locale}:{value:{nameFa:string;namePs:string;nameEn:string};
  update:(key:"nameFa"|"namePs"|"nameEn",value:string)=>void;locale:Locale}) {
  return <div className="menu-form-grid">{(["nameFa","namePs","nameEn"] as const).map(key=>
    <label key={key} className="field"><span>{m3(locale,key)}</span><input
      required={key==="nameFa"} minLength={key==="nameFa"?2:undefined} maxLength={100}
      value={value[key]} onChange={e=>update(key,e.target.value)}/></label>)}</div>;
}
export function CategoryEditor({locale,busy,close,submit,initial}:{initial?:Category}&Common){
  const [form,setForm]=useState({nameFa:initial?.nameFa??"",namePs:initial?.namePs??"",
    nameEn:initial?.nameEn??"",description:initial?.description??"",sortOrder:initial?.sortOrder??0,
    published:initial?.published??false});
  async function save(e:FormEvent){e.preventDefault();await submit({...form,...initial?{version:initial.version}:{}});}
  return <form className="menu-editor" onSubmit={e=>void save(e)}>
    <ModalHeader title={m3(locale,"categoryInfo")} close={close} locale={locale}/>
    <Names value={form} locale={locale} update={(key,value)=>setForm(f=>({...f,[key]:value}))}/>
    <label className="field"><span>{m3(locale,"description")}</span>
      <textarea maxLength={500} rows={3} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></label>
    <div className="menu-form-grid">
      <label className="field"><span>{m3(locale,"categoryOrder")}</span><input type="number" min={-9999} max={9999}
        value={form.sortOrder} onChange={e=>setForm(f=>({...f,sortOrder:Number(e.target.value)}))}/></label>
      <label className="menu-check"><input type="checkbox" checked={form.published}
        onChange={e=>setForm(f=>({...f,published:e.target.checked}))}/><span>{m3(locale,"show")}</span></label>
    </div>
    <ModalActions locale={locale} busy={busy} close={close} editing={!!initial}/>
  </form>;
}
type Choice={id?:string;nameFa:string;namePs:string;nameEn:string;delta:string;active:boolean;sortOrder:number;localKey:string};
export function GroupEditor({locale,busy,close,submit,initial}:{initial?:Group}&Common){
  const [name,setName]=useState({nameFa:initial?.nameFa??"",namePs:initial?.namePs??"",nameEn:initial?.nameEn??""});
  const [mode,setMode]=useState<"single"|"multiple">(initial?.selectionMode??"single");
  const [min,setMin]=useState(initial?.minSelections??0),[max,setMax]=useState(initial?.maxSelections??1);
  const [choices,setChoices]=useState<Choice[]>(initial?.options.map(o=>({...o,delta:moneyInput(o.deltaMinor),localKey:o.id}))??[
    {nameFa:"",namePs:"",nameEn:"",delta:"0.00",active:true,sortOrder:0,localKey:"new-0"}]);
  const [err,setErr]=useState("");
  function optionChange(index:number,key:keyof Choice,value:string|boolean|number){
    setChoices(v=>v.map((row,i)=>i===index?{...row,[key]:value}:row));
  }
  async function save(e:FormEvent){
    e.preventDefault();setErr("");
    const options=choices.map(c=>({...c,deltaMinor:parseMoney(c.delta)}));
    const countActive=choices.filter(c=>c.active).length;
    if(options.some(c=>c.deltaMinor===null)||min>max||max>countActive||(mode==="single"&&max>1)||choices.length===0){
      setErr(m3(locale,"minMaxHint"));return;
    }
    await submit({...name,selectionMode:mode,minSelections:min,maxSelections:max,
      options:options.map(({id,nameFa,namePs,nameEn,deltaMinor,active,sortOrder})=>({
        ...(id?{id}:{}),nameFa,namePs,nameEn,deltaMinor,active,sortOrder})),
      ...(initial?{version:initial.version}:{})});
  }
  return <form className="menu-editor" onSubmit={e=>void save(e)}>
    <ModalHeader title={m3(locale,"groupInfo")} close={close} locale={locale}/>
    <Names value={name} locale={locale} update={(k,v)=>setName(p=>({...p,[k]:v}))}/>
    <div className="menu-form-grid">
      <label className="field"><span>{m3(locale,"groupMode")}</span><select value={mode} onChange={e=>{
        const next=e.target.value as "single"|"multiple";setMode(next);if(next==="single"){setMax(m=>Math.min(m,1));setMin(m=>Math.min(m,1));}
      }}><option value="single">{m3(locale,"single")}</option><option value="multiple">{m3(locale,"multiple")}</option></select></label>
      <label className="field"><span>{m3(locale,"minimum")}</span><input type="number" min={0} max={10} value={min}
        onChange={e=>setMin(Number(e.target.value))}/></label>
      <label className="field"><span>{m3(locale,"maximum")}</span><input type="number" min={0} max={mode==="single"?1:10}
        value={max} onChange={e=>setMax(Number(e.target.value))}/></label>
    </div>
    <div className="menu-editor-section-heading"><h3>{m3(locale,"options")}</h3><button className="button button-small" type="button"
      disabled={choices.length>=30} onClick={()=>setChoices(p=>[...p,{localKey:crypto.randomUUID(),nameFa:"",namePs:"",
        nameEn:"",delta:"0.00",active:true,sortOrder:p.length}])}><Plus size={16}/>{m3(locale,"addOption")}</button></div>
    <p className="muted">{m3(locale,"minMaxHint")}</p>
    {choices.map((c,i)=><div className="menu-choice" key={c.localKey}>
      <div className="menu-choice-heading"><b>{m3(locale,"option")} {i+1}</b><button className="icon-action danger-button"
        type="button" aria-label={m3(locale,"remove")} disabled={choices.length<=1}
        onClick={()=>setChoices(p=>p.filter(x=>x.localKey!==c.localKey))}><Trash2 size={17}/></button></div>
      <div className="menu-form-grid">{(["nameFa","namePs","nameEn"] as const).map(k=>
        <label className="field" key={k}><span>{m3(locale,k)}</span><input
          required={k==="nameFa"} minLength={k==="nameFa"?2:undefined} maxLength={100}
          value={c[k]} onChange={e=>optionChange(i,k,e.target.value)}/></label>)}
        <label className="field"><span>{m3(locale,"optionPrice")}</span><input type="text" inputMode="decimal" dir="ltr"
          value={c.delta} onChange={e=>optionChange(i,"delta",e.target.value)}/></label>
        <label className="menu-check"><input type="checkbox" checked={c.active}
          onChange={e=>optionChange(i,"active",e.target.checked)}/>{m3(locale,"activeOption")}</label></div>
    </div>)}
    {err&&<p className="form-error" role="alert">{err}</p>}
    <ModalActions locale={locale} busy={busy} close={close} editing={!!initial}/>
  </form>;
}
export function ItemEditor({locale,busy,close,submit,initial,categories,groups}:{initial?:ItemDetail;
  categories:Category[];groups:Group[]}&Common){
  const [form,setForm]=useState({
    nameFa:initial?.nameFa??"",namePs:initial?.namePs??"",nameEn:initial?.nameEn??"",
    categoryId:initial?.categoryId??categories[0]?.id??"",description:initial?.description??"",
    sku:initial?.sku??"",price:moneyInput(initial?.priceMinor??0),
    imageId:initial?.imageId??null as string|null,
    allergens:initial?.allergens??[] as string[],
    preparationMinutes:initial?.preparationMinutes??null as number|null,
    sortOrder:initial?.sortOrder??0,published:initial?.published??false,
    groupIds:initial?.groupIds??[] as string[]
  });
  const [uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState(""),[err,setErr]=useState("");
  const selectedCategory=categories.find(c=>c.id===form.categoryId);
  async function upload(file:File|undefined){
    if(!file)return;
    setUploadError("");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024){
      setUploadError(m3(locale,"imageHint"));return;
    }
    setUploading(true);
    try {
      const response=await fetch(API_URL+"/api/menu/images",{method:"POST",credentials:"include",
        headers:{"Content-Type":file.type},body:file});
      const data=await response.json() as {id?:string;message?:string};
      if(!response.ok||!data.id)throw new Error(data.message??m3(locale,"error"));
      setForm(s=>({...s,imageId:data.id??null}));
    }catch(e){setUploadError(e instanceof Error?e.message:m3(locale,"error"));}
    finally{setUploading(false);}
  }
  async function save(e:FormEvent){
    e.preventDefault();setErr("");
    const priceMinor=parseMoney(form.price);
    if(priceMinor===null){setErr(m3(locale,"price")+" · 0.00–10000000.00");return;}
    if(form.published&&!selectedCategory?.published){setErr(m3(locale,"mustPublishCategory"));return;}
    if(!form.categoryId){setErr(m3(locale,"categoryRequired"));return;}
    await submit({...form,priceMinor,...form.preparationMinutes?{preparationMinutes:form.preparationMinutes}:{preparationMinutes:null},
      ...(initial?{version:initial.version}:{}),imageId:form.imageId});
  }
  return <form className="menu-editor" onSubmit={e=>void save(e)}>
    <ModalHeader title={m3(locale,"itemInfo")} close={close} locale={locale}/>
    <Names locale={locale} value={form} update={(key,value)=>setForm(s=>({...s,[key]:value}))}/>
    <div className="menu-form-grid">
      <label className="field"><span>{m3(locale,"category")} *</span>
        <select required value={form.categoryId} onChange={e=>setForm(s=>({...s,categoryId:e.target.value}))}>
          <option value="">{m3(locale,"noCategory")}</option>{categories.map(c=><option key={c.id} value={c.id}>
            {c.nameFa}{c.published?"":" · "+m3(locale,"draft")}</option>)}</select></label>
      <label className="field"><span>{m3(locale,"sku")}</span><input dir="ltr" pattern="[A-Za-z0-9_-]{2,50}"
        maxLength={50} value={form.sku} onChange={e=>setForm(s=>({...s,sku:e.target.value}))}/></label>
      <label className="field"><span>{m3(locale,"price")}</span><input dir="ltr" type="text" inputMode="decimal" required
        value={form.price} onChange={e=>setForm(s=>({...s,price:e.target.value}))}/></label>
      <label className="field"><span>{m3(locale,"prep")}</span><input type="number" min={1} max={240}
        value={form.preparationMinutes??""} onChange={e=>setForm(s=>({...s,preparationMinutes:e.target.value?Number(e.target.value):null}))}/></label>
      <label className="field form-span"><span>{m3(locale,"description")}</span>
        <textarea rows={3} maxLength={500} value={form.description}
          onChange={e=>setForm(s=>({...s,description:e.target.value}))}/><small className="muted">{m3(locale,"descriptionHint")}</small></label>
    </div>
    <div className="menu-editor-section-heading"><h3>{m3(locale,"photos")}</h3></div>
    <div className="menu-photo-upload"><div className="menu-photo-thumb">
      {form.imageId?<img src={API_URL+"/api/menu/images/"+form.imageId} alt={m3(locale,"image")}/>:<ImagePlus size={32}/>}</div>
      <div><label className="button button-small menu-upload-label"><UploadCloud size={16}/>
        {uploading?m3(locale,"loading"):m3(locale,"upload")}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading}
          onChange={e=>void upload(e.target.files?.[0])}/></label>
        {form.imageId&&<button className="button button-small" type="button"
          onClick={()=>setForm(s=>({...s,imageId:null}))}>{m3(locale,"remove")}</button>}
        <p className="muted">{m3(locale,"imageHint")}</p></div></div>
    {uploadError&&<p role="alert" className="form-error">{uploadError}</p>}
    <div className="menu-editor-section-heading"><h3>{m3(locale,"allergens")}</h3></div>
    <p className="muted">{m3(locale,"allergenHint")}</p>
    <div className="menu-checkbox-group">{allergens.map(x=><label className="menu-check" key={x}><input type="checkbox"
      checked={form.allergens.includes(x)} onChange={e=>setForm(s=>({...s,allergens:e.target.checked?[...s.allergens,x]:s.allergens.filter(a=>a!==x)}))}/>
      {x}</label>)}</div>
    <div className="menu-editor-section-heading"><h3>{m3(locale,"modifiers")}</h3></div>
    <div className="menu-checkbox-group">{groups.length?groups.map(g=><label className="menu-check" key={g.id}>
      <input type="checkbox" checked={form.groupIds.includes(g.id)}
        onChange={e=>setForm(s=>({...s,groupIds:e.target.checked?[...s.groupIds,g.id]:s.groupIds.filter(id=>id!==g.id)}))}/>
      <span>{g.nameFa} <small className="muted">({g.minSelections}–{g.maxSelections})</small></span></label>):
      <p className="muted">{m3(locale,"emptyGroups")}</p>}</div>
    <div className="menu-form-grid">
      <label className="field"><span>{m3(locale,"sort")}</span><input type="number" min={-9999} max={9999} value={form.sortOrder}
        onChange={e=>setForm(s=>({...s,sortOrder:Number(e.target.value)}))}/></label>
      <label className="menu-check"><input type="checkbox" checked={form.published}
        onChange={e=>setForm(s=>({...s,published:e.target.checked}))}/><span>{m3(locale,"show")}</span></label>
    </div>
    {err&&<p role="alert" className="form-error">{err}</p>}
    <ModalActions locale={locale} busy={busy||uploading} close={close} editing={!!initial}/>
  </form>;
}
function ModalHeader({title,close,locale}:{title:string;close:()=>void;locale:Locale}){
  return <header className="menu-dialog-head"><div><span className="eyebrow">{m3(locale,"editor")}</span><h2 id="menu-dialog-title">{title}</h2></div>
    <button type="button" className="icon-action" onClick={close} aria-label={m3(locale,"cancel")}><X size={22}/></button></header>;
}
function ModalActions({locale,busy,close,editing}:{locale:Locale;busy:boolean;close:()=>void;editing:boolean}){
  return <footer className="menu-dialog-footer"><button type="button" className="button" onClick={close} disabled={busy}>{m3(locale,"cancel")}</button>
    <button type="submit" className="button button-primary" disabled={busy}>{busy?<span className="spinner"/>:<CheckCircle2 size={18}/>}
      {busy?m3(locale,"saving"):m3(locale,editing?"save":"create")}</button></footer>;
}
