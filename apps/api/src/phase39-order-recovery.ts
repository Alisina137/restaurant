import type {Request} from "express";

/**
 * Phase 39: respond safely when a submission cannot determine its final state.
 * A database timeout (or a broken network response after COMMIT) must never
 * trigger a fresh order identifier or automatic re-submission by the server.
 * The waiter device keeps the original encrypted draft + idempotency key.
 *
 * Only the two authenticated, idempotency-keyed order creation routes receive
 * recovery advice. No broad retry hint on payments, guest PINs or menu writes.
 */
const safePgCodes=new Set(["55P03","40P01","40001","57014","ECONNRESET","ECONNREFUSED",
 "ETIMEDOUT","EPIPE","ENOTFOUND","ECONNABORTED"]);

export const CHECKOUT_LOCK_TIMEOUT_MS=8000;
export const ORDER_RETRY_AFTER_SECONDS=3;

export function isIdempotentOrderSubmission(req:Pick<Request,"method"|"baseUrl"|"path">):boolean{
 if(req.method!=="POST")return false;
 if(req.baseUrl==="/api/orders")return /^\/visits\/[^/]{1,100}\/rounds$/.test(req.path);
 return req.baseUrl==="/api/guest"&&req.path==="/orders";
}

/**
 * Traverse only driver error.cause, never parse/log message/SQL/host.
 * A wrapped PG SQLSTATE or a transport failure means the API cannot safely
 * report what happened. This is a client *recheck*, not server-side retry.
 */
export function isTransientOrderDatabaseFailure(error:unknown):boolean{
 let current:unknown=error;
 const seen=new Set<object>();
 for(let level=0;level<6;level++){
  if(!current||typeof current!=="object"||seen.has(current))break;
  seen.add(current);
  const payload=current as {code?:unknown;cause?:unknown};
  const code=typeof payload.code==="string"?payload.code:"";
  if(safePgCodes.has(code)||/^08[A-Z0-9]{3}$/.test(code))return true;
  current=payload.cause;
 }
 return false;
}

export const uncertainOrderResponse={
 code:"ORDER_STATUS_UNCERTAIN",
 message:"Order status could not be confirmed. Check the same order with the original submission key; do not create a new order.",
 statusUncertain:true,
 retrySameKey:true
} as const;
