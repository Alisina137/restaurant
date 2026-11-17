import assert from "node:assert/strict";
import {alertIsNew,canVibrate,inboxIsValid,noticeScope,vibrationKeyFor,type ReadyInbox} from "./mobile26-data";
import {m26} from "./mobile26-copy";
assert.equal(noticeScope("user-1","tenant-a"),"user-1|tenant-a");
assert.equal(noticeScope("user-1",null),null);
assert.notEqual(vibrationKeyFor("user-1","tenant-a"),vibrationKeyFor("user-2","tenant-a"));
assert.notEqual(vibrationKeyFor("user-1","tenant-a"),vibrationKeyFor("user-1","tenant-b"));
assert.equal(vibrationKeyFor("user-1",null),null);
assert.match(vibrationKeyFor("x@y","a:b")!,/^[a-zA-Z0-9._-]+$/);
const now=Date.parse("2026-11-17T12:00:00.000Z");
const alert={id:"a",lastNotifiedAt:new Date(now-3000).toISOString()};
const old=new Map<string,string>();
assert.equal(alertIsNew(old,alert,false,now),false,"First poll must never vibrate");
assert.equal(alertIsNew(old,alert,true,now),true,"New foreground alert may vibrate");
old.set(alert.id,alert.lastNotifiedAt);
assert.equal(alertIsNew(old,alert,true,now),false,"Same notice does not vibrate twice");
assert.equal(alertIsNew(old,{...alert,lastNotifiedAt:new Date(now+1000).toISOString()},true,now),true,
 "A reminder to an already observed notice is distinct");
assert.equal(alertIsNew(new Map(),{...alert,lastNotifiedAt:new Date(now-600000).toISOString()},true,now),false,
 "Old hydrated notices must never trigger vibration");
assert.equal(canVibrate(now-21000,now),true);
assert.equal(canVibrate(now-19999,now),false);
assert.equal(canVibrate(now+100,now),false);
const inbox:ReadyInbox={items:[{id:"x",type:"ticket_ready",roundId:"round",ticketId:"ticket",
 visitId:"visit",readAt:null,createdAt:alert.lastNotifiedAt,lastNotifiedAt:alert.lastNotifiedAt,
 tableLabel:"T-1",tableId:"table",status:"ready"}],total:1,unread:1,page:1,perPage:20};
assert.equal(inboxIsValid(inbox),true);
assert.equal(inboxIsValid({...inbox,total:-1}),false);
assert.equal(inboxIsValid({...inbox,items:Array(21).fill(inbox.items[0])}),false);
assert.equal(inboxIsValid({...inbox,perPage:0}),false);
assert.equal(inboxIsValid({...inbox,items:[{...inbox.items[0],readAt:4}]}),false);
for(const locale of ["en","fa-AF","ps-AF"] as const){
 for(const key of ["connectionLost","serverUnavailable","retryConnection","deliveryMode",
  "stale","markAll","markAllConfirm","noAccess","helpText","vibrationHelp","offlineChanges",
  "noIdentity","securityDescription"] as const)
  assert.ok(m26(locale,key).length>=5,locale+" missing "+key);
}
console.info("PASS P26 native: per-account vibration consent, foreground-only notices, bounded server inbox, honest offline and three-language messaging.");
