import test from "node:test";import assert from "node:assert/strict";
import {roleAllowed,rtl,validLocale} from "@dineflow/core";
test("RTL/LTR languages",()=>{assert.ok(rtl("fa"));assert.ok(rtl("ps"));assert.ok(!rtl("en"));assert.ok(!validLocale("xx"));});
test("tenant isolation",()=>{assert.ok(roleAllowed("WAITER","tenant-1","tenant-1"));assert.ok(!roleAllowed("WAITER","tenant-1","tenant-2"));assert.ok(!roleAllowed("PLATFORM_ADMIN",null,"tenant-1"));});
