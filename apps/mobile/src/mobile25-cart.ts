import {cartPrice,newKey,type CartLine,type MenuData,type MenuGroup,type MenuItem,type OrderDraft} from "./order-types";

export const MAX_LINES=40;
export const MAX_QTY=99;
export type CartIssue="empty"|"quantity"|"item_missing"|"item_changed"|"sold_out"|"groups_changed"|
 "modifier_changed"|"options_invalid"|"line_note"|"order_note"|"amount"|"key"|"max_lines";
export type LineIssue={index:number;code:CartIssue};
export type CartReview={issues:LineIssue[];subtotalMinor:number|null;lineTotals:(number|null)[];count:number;valid:boolean};

/** Read-only, strict local preflight. Server remains the only price/stock authority. */
export function reviewCart(draft:OrderDraft,menu:MenuData):CartReview{
 const issues:LineIssue[]=[];
 const lineTotals:(number|null)[]=[];
 let subtotal=0,count=0;
 if(!draft.lines.length)issues.push({index:-1,code:"empty"});
 if(draft.lines.length>MAX_LINES)issues.push({index:-1,code:"max_lines"});
 if(typeof draft.note!=="string"||draft.note.length>500)
  issues.push({index:-1,code:"order_note"});
 if(!/^[A-Za-z0-9_-]{12,100}$/.test(draft.idempotencyKey))
  issues.push({index:-1,code:"key"});
 for(let i=0;i<draft.lines.length;i++){
  const line=draft.lines[i]!;
  const item=menu.items.find(x=>x.id===line.itemId);
  const problem=(code:CartIssue)=>issues.push({index:i,code});
  if(!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>MAX_QTY)problem("quantity");
  count+=Math.max(0,Number.isSafeInteger(line.quantity)?line.quantity:0);
  if(typeof line.note!=="string"||line.note.length>250)problem("line_note");
  if(!item)problem("item_missing");
  else{
   if(item.soldOut)problem("sold_out");
   if(item.version!==line.itemVersion)problem("item_changed");
   const ids=item.groupIds;
   const submitted=line.selections;
   if(!Array.isArray(submitted)||submitted.length>12||
     ids.length!==submitted.length||
     new Set(submitted.map(s=>s.groupId)).size!==submitted.length||
     ids.some(x=>!submitted.some(s=>s.groupId===x)) ||
     submitted.some(s=>!ids.includes(s.groupId)))problem("groups_changed");
   for(const choice of submitted){
    const group=menu.groups.find(g=>g.id===choice.groupId);
    if(!group||group.version!==choice.version){problem("modifier_changed");continue;}
    if(!validOptions(group,choice.optionIds))problem("options_invalid");
   }
  }
  // No invented zero prices or totals for invalid records.
  const validLine=!issues.some(x=>x.index===i);
  const lineTotal=validLine?cartPrice(line,menu):null;
  if(lineTotal===null||!Number.isSafeInteger(lineTotal)||lineTotal<0||lineTotal>2_000_000_000){
   if(validLine)problem("amount");lineTotals.push(null);
  }else{lineTotals.push(lineTotal);subtotal+=lineTotal;}
 }
 if(subtotal>2_000_000_000)issues.push({index:-1,code:"amount"});
 return {issues,subtotalMinor:issues.length?null:subtotal,lineTotals,
  count,valid:issues.length===0};
}
export function validOptions(group:MenuGroup,optionIds:string[]):boolean{
 return Array.isArray(optionIds)&&optionIds.length<=10&&
  optionIds.length>=group.minSelections&&optionIds.length<=group.maxSelections&&
  (group.selectionMode!=="single"||optionIds.length<=1)&&
  new Set(optionIds).size===optionIds.length&&
  optionIds.every(id=>group.options.some(option=>option.id===id));
}
export function toggleOption(group:MenuGroup,current:string[],optionId:string):string[]{
 if(!group.options.some(option=>option.id===optionId))return current;
 if(current.includes(optionId))return current.filter(id=>id!==optionId);
 if(group.selectionMode==="single")return [optionId];
 return current.length>=group.maxSelections?current:[...current,optionId];
}
export function addCartLine(draft:OrderDraft,line:CartLine,index?:number):OrderDraft{
 if(!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>MAX_QTY||
  line.note.length>250)return draft;
 if(index!==undefined){
  if(index<0||index>=draft.lines.length)return draft;
  return {...draft,lines:draft.lines.map((x,i)=>i===index?line:x),idempotencyKey:newKey()};
 }
 // Preserve user-entered order when another line has different modifiers or notes.
 const signature=(x:CartLine)=>JSON.stringify({itemId:x.itemId,itemVersion:x.itemVersion,note:x.note,
  selections:x.selections.map(s=>({groupId:s.groupId,version:s.version,
   optionIds:[...s.optionIds].sort()})).sort((a,b)=>a.groupId.localeCompare(b.groupId))});
 const at=draft.lines.findIndex(x=>signature(x)===signature(line)&&x.quantity+line.quantity<=MAX_QTY);
 if(at>=0)return {...draft,lines:draft.lines.map((x,i)=>i===at?
  {...x,quantity:x.quantity+line.quantity}:x),idempotencyKey:newKey()};
 if(draft.lines.length>=MAX_LINES)return draft;
 return {...draft,lines:[...draft.lines,line],idempotencyKey:newKey()};
}
export function setLineQuantity(draft:OrderDraft,index:number,next:number):OrderDraft{
 if(!Number.isInteger(next)||next<1||next>MAX_QTY||!draft.lines[index]||
  draft.lines[index]!.quantity===next)return draft;
 return {...draft,lines:draft.lines.map((x,i)=>i===index?{...x,quantity:next}:x),
  idempotencyKey:newKey()};
}
export function removeLine(draft:OrderDraft,index:number):OrderDraft{
 if(!draft.lines[index])return draft;
 return {...draft,lines:draft.lines.filter((_,i)=>i!==index),idempotencyKey:newKey()};
}
export function setOrderNote(draft:OrderDraft,note:string):OrderDraft{
 if(note.length>500||draft.note===note)return draft;
 return {...draft,note,idempotencyKey:newKey()};
}
export function validateStoredDraft(raw:unknown):raw is OrderDraft{
 if(!raw||typeof raw!=="object")return false;
 const d=raw as Partial<OrderDraft>;
 return Array.isArray(d.lines)&&d.lines.length<=MAX_LINES&&typeof d.note==="string"&&d.note.length<=500&&
  typeof d.idempotencyKey==="string"&&/^[A-Za-z0-9_-]{12,100}$/.test(d.idempotencyKey)&&
  d.lines.every(line=>line&&typeof line==="object"&&typeof line.itemId==="string"&&
   typeof line.itemVersion==="number"&&Number.isSafeInteger(line.itemVersion)&&line.itemVersion>0&&
   Number.isSafeInteger(line.quantity)&&line.quantity>=1&&line.quantity<=MAX_QTY&&
   typeof line.note==="string"&&line.note.length<=250&&Array.isArray(line.selections)&&
   line.selections.length<=12&&line.selections.every(s=>s&&typeof s.groupId==="string"&&
    Number.isSafeInteger(s.version)&&s.version>0&&Array.isArray(s.optionIds)&&
    s.optionIds.length<=10&&s.optionIds.every(id=>typeof id==="string")));
}
export function issueForLine(review:CartReview,index:number):CartIssue|null{
 return review.issues.find(x=>x.index===index)?.code??null;
}
