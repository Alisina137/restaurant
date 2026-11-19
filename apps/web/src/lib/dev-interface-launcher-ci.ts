import assert from "node:assert/strict";
import {apiReadyReply,interfaceCards,parseGuestEntryRoute} from "./dev-interface-launcher";
import {dl} from "./dev-interface-launcher-copy";

const origin="http://localhost:3000";
const token="L7Fps9Hd_aBcD_1234567890qwertyUIOPasdfghjkl";
const expected="/g/demo-restaurant/t/"+token;
assert.equal(interfaceCards.length,6);
assert.deepEqual(interfaceCards.map(x=>x.id),[
 "management","waiter","kitchen","cashier","customer","platform"]);
assert.equal(new Set(interfaceCards.map(x=>x.id)).size,6);
assert.equal(interfaceCards.find(x=>x.id==="management")?.path,"/app/overview");
assert.equal(interfaceCards.find(x=>x.id==="waiter")?.path,null);
assert.equal(interfaceCards.find(x=>x.id==="kitchen")?.path,"/kitchen/live");
assert.equal(interfaceCards.find(x=>x.id==="cashier")?.path,"/cashier/checks");
assert.equal(interfaceCards.find(x=>x.id==="platform")?.path,"/platform/overview");
assert.equal(parseGuestEntryRoute(expected,origin),expected);
assert.equal(parseGuestEntryRoute(origin+expected,origin),expected);
assert.equal(parseGuestEntryRoute(origin+expected+"/",origin),expected);
assert.equal(parseGuestEntryRoute("https://evil.test"+expected,origin),expected,
 "Only local path is returned; never redirect to untrusted origin");
for(const input of [
 "", "/login", "/app/overview", "javascript:alert(1)",
 "https://example.test/evil", "//example.test/evil",
 expected+"?next=https://evil.test",expected+"#x",
 "/g/demo/t/short","/g/demo/t/"+token+"/../../platform/overview",
 "http://user:password@localhost:3000"+expected,
 "/g/demo/t/"+token+"?x=1","x".repeat(901),"/g/%2F/t/"+token
])assert.equal(parseGuestEntryRoute(input,origin),null,"Rejected unsafe QR route: "+input.slice(0,70));
assert.equal(apiReadyReply({status:"ready"}),true);
assert.equal(apiReadyReply({status:"ok"}),false);
assert.equal(apiReadyReply({code:"DB_UNAVAILABLE"}),false);
assert.equal(apiReadyReply(null),false);
for(const locale of ["en","fa-AF","ps-AF"] as const){
 for(const key of [
  "tag","title","services","web","api","mobile","ready","checking","unavailable",
  "run","signIn","interfaceLabel","management","waiter","kitchen","cashier",
  "customer","platform","open","guestOpen","guestUrl","guestInvalid",
  "guestStep1","guestStep2","guestStep3","disclaimer","helpBody","localHint"
 ] as const)assert.ok(dl(locale,key).length>=3,locale+" missing "+key);
}
console.info("PASS dev launcher: six actual role targets, closed guest-route navigation, real API readiness response and three locales.");
