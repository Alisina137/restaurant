import assert from "node:assert/strict";
import {m28} from "./mobile28-copy";
for(const locale of ["en","fa-AF","ps-AF"] as const)
 for(const key of ["confirmPickup","pickup","acknowledged","already","pickupHint",
  "pickupDone","serveSeparate","pickupPending","pickupError","conflict"] as const)
  assert.ok(m28(locale,key).length>5,locale+" missing "+key);
console.info("PASS P28 native: explicit receipt copy for English, Dari and Pashto.");
