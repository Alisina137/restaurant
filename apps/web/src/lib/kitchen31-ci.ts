import assert from "node:assert/strict";
import {AGE_FILTERS,validGapPage,gapStatus,elapsedGap} from "./kitchen31";
import {k31} from "./kitchen31-copy";
const now="2026-11-18T08:00:00.000Z";
const uuid="70e76694-d750-4c78-b41c-80c32b82e922";
const row={ticketId:uuid,roundId:uuid,tableLabel:"T01",roundNumber:1,
 status:"new",createdAt:now,version:1};
const page={page:1,perPage:10,total:1,minAgeSeconds:30,table:"",
 oldestAt:now,checkedAt:now,evidence:"missing_foreground_render_report",items:[row]};
assert.equal(validGapPage(page,30),true);
assert.equal(validGapPage({...page,table:"T01"},30,"T01"),true);
assert.equal(validGapPage({...page,table:"T01"},30),false);
assert.equal(validGapPage(page,60),false);
assert.equal(validGapPage({...page,perPage:500},30),false);
assert.equal(validGapPage({...page,page:0},30),false);
assert.equal(validGapPage({...page,total:0},30),false);
assert.equal(validGapPage({...page,evidence:"human_saw_food"},30),false);
assert.equal(validGapPage({...page,items:[{...row,ticketId:"invalid"}]},30),false);
assert.equal(validGapPage({...page,items:[{...row,status:"served"}]},30),false);
assert.equal(validGapPage({...page,items:[{...row,version:0}]},30),false);
assert.equal(validGapPage({...page,items:[{...row,createdAt:"bad"}]},30),false);
assert.equal(validGapPage({...page,items:[]},30),true);
assert.deepEqual(AGE_FILTERS,[0,30,60,180,300]);
assert.equal(gapStatus(30),"recent");
assert.equal(gapStatus(59),"recent");
assert.equal(gapStatus(60),"investigate");
assert.equal(elapsedGap(now,Date.parse(now)+120_000),120);
assert.equal(elapsedGap(now,Date.parse(now)-5000),0);
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["title","subtitle","toggle","close","minimumAge","age30",
  "age60","age180","age300","tableSearch","searchTable","clear","noResults",
  "failed","ticket","table","state","details","diagnosis","disclaimer",
  "aging","early","next","previous","measured"] as const)
  assert.ok(k31(locale,key).length>=2,locale+" missing translation "+key);
console.info("PASS P31 pure: bounded visibility gap input validation, role-neutral diagnostic semantics and 3-language controls.");
