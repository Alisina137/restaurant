import type {Table} from "./floor";
import type {ServiceRequest} from "./service-copy";
export type TableOperations={canSeat:boolean;canClean:boolean;canServe:boolean;readOnly:boolean};
export type SeatResult="ok"|"invalid"|"capacity";
export function seatingValidation(raw:string,seats:number,role:"waiter"|"manager"="waiter"):SeatResult{
 if(!/^[0-9]{1,2}$/.test(raw.trim()))return "invalid";
 const value=Number(raw.trim());
 if(!Number.isSafeInteger(value)||value<1||value>30)return "invalid";
 return role==="waiter"&&value>seats?"capacity":"ok";
}
/** Server-authoritative eligibility is also verified by the secured POST routes. */
export function tableOperations(table:Table|null,canOpen:boolean):TableOperations{
 return {canSeat:!!table&&table.status==="available"&&canOpen,
  canClean:!!table&&table.status==="cleaning"&&canOpen,
  canServe:!!table&&table.status==="occupied"&&!!table.visitId&&canOpen,
  readOnly:!table||!canOpen};
}
export function serviceActionAllowed(request:ServiceRequest,action:"acknowledge"|"resolve"){
 return action==="acknowledge"?request.status==="pending":
  request.status==="pending"||request.status==="acknowledged";
}
export function readyToDeliver(status:string){
 return status==="ready"||status==="picked_up";
}
export function visitOrderCount(rounds:{id:string}[]|null){
 return rounds?.length??null;
}
