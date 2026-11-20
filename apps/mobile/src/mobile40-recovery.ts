/**
 * Phase 40: an explicit, user-initiated reconciliation of an uncertain waiter
 * checkout. A confirmed existing receipt never triggers a second POST.
 * Only a VERIFIED 404/NOT_FOUND permits same-key replay. Every other failure
 * fails closed: the encrypted pending draft must remain untouched.
 *
 * The caller has already persisted the exact submission key + cart before its
 * first POST. This helper never generates keys, edits carts or schedules retries.
 */
export type ExistingOrderReceipt={status:"accepted";roundId:string};
export type OrderPostReceipt={created:boolean;round:{id:string}};
export type RecoveredOrder=OrderPostReceipt&{source:"receipt"|"original_key_replay"};

export async function reconcilePendingOrder(
 lookup:()=>Promise<ExistingOrderReceipt>,
 replay:()=>Promise<OrderPostReceipt>,
 verifiedNotFound:(error:unknown)=>boolean
):Promise<RecoveredOrder>{
 let absent=false;
 try{
  const receipt=await lookup();
  if(receipt?.status!=="accepted"||typeof receipt.roundId!=="string"||
   !/^[0-9a-f-]{36}$/i.test(receipt.roundId))
    throw new Error("The receipt lookup returned an invalid response. Keep the original pending cart.");
  return {created:false,round:{id:receipt.roundId},source:"receipt"};
 }catch(error){
  if(!verifiedNotFound(error))throw error;
  absent=true;
 }
 if(!absent)throw new Error("Order status must be verified before replay.");
 const committed=await replay();
 if(!committed||!committed.round||typeof committed.round.id!=="string"||
  !/^[0-9a-f-]{36}$/i.test(committed.round.id))
  throw new Error("Order reply is not confirmed. Keep the original pending cart.");
 return {...committed,source:"original_key_replay"};
}
