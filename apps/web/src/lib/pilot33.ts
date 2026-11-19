/** P33 operator incident data is not physical release certification. */
export const PILOT_GATES=[
 "roles","qr","orders","cash","billing","languages","devices","accessibility",
 "reliability","backups","rollback","shift"
] as const;
export type PilotGate=typeof PILOT_GATES[number];
export type IncidentSeverity="p0"|"p1"|"p2";
export type IncidentStatus="open"|"resolved";
export type PilotIncident={
 id:string;tenantId:string;gateKey:PilotGate;severity:IncidentSeverity;
 title:string;details:string;status:IncidentStatus;
 version:number;openedBy:string;resolvedAt:string|null;
 createdAt:string;updatedAt:string;
};
export type IncidentList={
 items:PilotIncident[];total:number;page:number;perPage:10;status:IncidentStatus|"all";
 severity:IncidentSeverity|"all";checkedAt:string;
};
export type IncidentEvent={id:number;tenantId:string;incidentId:string;
 action:"opened"|"resolved"|"reopened";severity:IncidentSeverity;
 gateKey:PilotGate;note:string;actorId:string;version:number;createdAt:string};
export type IncidentHistory={incidentId:string;version:number;events:IncidentEvent[]};
export type IncidentSummary={total:number;open:number;blocking:number};
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const date=(value:unknown)=>typeof value==="string"&&Number.isFinite(Date.parse(value));
export function validPilotIncident(value:unknown):value is PilotIncident{
 if(!value||typeof value!=="object")return false;
 const x=value as Partial<PilotIncident>;
 return typeof x.id==="string"&&uuid.test(x.id)&&typeof x.tenantId==="string"&&
  PILOT_GATES.includes(x.gateKey as PilotGate)&&
  ["p0","p1","p2"].includes(x.severity??"")&&
  ["open","resolved"].includes(x.status??"")&&
  typeof x.title==="string"&&x.title.length>=8&&x.title.length<=120&&
  typeof x.details==="string"&&x.details.length>=25&&x.details.length<=1500&&
  Number.isSafeInteger(x.version)&&Number(x.version)>=1&&
  date(x.createdAt)&&date(x.updatedAt)&&
  (x.resolvedAt===null||date(x.resolvedAt));
}
export function validIncidentList(value:unknown,status:string,severity:string,page:number):value is IncidentList{
 if(!value||typeof value!=="object")return false;
 const x=value as Partial<IncidentList>;
 return x.status===status&&x.severity===severity&&x.page===page&&x.perPage===10&&
  Number.isSafeInteger(x.total)&&Number(x.total)>=0&&
  date(x.checkedAt)&&Array.isArray(x.items)&&x.items.length<=10&&
  x.items.every(v=>validPilotIncident(v)&&(status==="all"||v.status===status)&&
   (severity==="all"||v.severity===severity));
}
export function validIncidentHistory(value:unknown,incidentId:string):value is IncidentHistory{
 if(!value||typeof value!=="object")return false;
 const x=value as Partial<IncidentHistory>;
 return x.incidentId===incidentId&&Number.isSafeInteger(x.version)&&Number(x.version)>=1&&
  Array.isArray(x.events)&&x.events.length>0&&x.events.length<=100&&
  x.events.every(e=>!!e&&e.incidentId===incidentId&&
   ["opened","resolved","reopened"].includes(e.action)&&
   typeof e.note==="string"&&e.note.length>=25&&date(e.createdAt)&&
   Number.isSafeInteger(e.version)&&e.version>=1);
}
export function hasBlockingIncidents(summary:IncidentSummary):boolean{
 return Number.isSafeInteger(summary.blocking)&&summary.blocking>0;
}
