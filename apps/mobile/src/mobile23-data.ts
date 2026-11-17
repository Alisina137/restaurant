import type {Board,Status,Table} from "./floor";
export type TableView="all"|"mine"|"attention";
export type TableFilter={tab:TableView;status:Status|null;section:string;query:string};
export type OrderTab="active"|"ready"|"completed";
/** Service metrics are derived from real floor rows, never a local simulation. */
export function floorMetrics(board:Board|null){
 const rows=board?.tables??[];
 return {
  all:rows.length,
  mine:rows.filter(t=>t.assignedWaiterId===board?.actorId).length,
  myOccupied:rows.filter(t=>t.status==="occupied"&&t.assignedWaiterId===board?.actorId).length,
  available:rows.filter(t=>t.status==="available").length,
  occupied:rows.filter(t=>t.status==="occupied").length,
  cleaning:rows.filter(t=>t.status==="cleaning").length,
  disabled:rows.filter(t=>t.status==="disabled").length
 };
}
export function filterFloorTables(board:Board|null,view:TableFilter):Table[]{
 if(!board||view.tab==="attention")return [];
 const query=view.query.trim().toLocaleLowerCase();
 return board.tables.filter(t=>
  (view.tab!=="mine"||t.assignedWaiterId===board.actorId)&&
  (!view.status||t.status===view.status)&&
  (!view.section||t.sectionId===view.section)&&
  (!query||[t.label,t.sectionName,t.assignedWaiterName??""]
    .some(text=>text.toLocaleLowerCase().includes(query))));
}
export function selectableVisits(board:Board|null):Table[]{
 if(!board)return [];
 return board.tables.filter(t=>t.status==="occupied"&&!!t.visitId&&
  t.assignedWaiterId===board.actorId);
}
export function orderTab(value:string|undefined):OrderTab{
 return value==="ready"||value==="completed"?value:"active";
}
