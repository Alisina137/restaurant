import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const paths=[
 "apps/mobile/app/notifications.tsx","apps/mobile/app/profile.tsx",
 "apps/mobile/app/security.tsx","apps/mobile/app/(main)/more.tsx",
 "apps/mobile/src/mobile26-data.ts","apps/mobile/src/mobile26-copy.ts",
 "apps/mobile/src/network-banner.tsx","apps/mobile/src/network-status.ts",
 "apps/mobile/src/use-ready-alert-badge.ts","apps/mobile/src/mobile26-ci.ts",
 "apps/api/src/phase6-service.ts","apps/api/src/phase26-ci.ts"
];
for(const p of paths)assert.ok(existsSync(new URL(p,root)),"Missing P26: "+p);
const text=p=>readFileSync(new URL(p,root),"utf8");
const [notices,profile,security,more,data,copy,banner,network,badge,unit,server,apiCI]=paths.map(text);
function has(source,markers,name){for(const marker of markers)
 assert.ok(source.includes(marker),"P26 "+name+" missing: "+marker);}
has(notices,["useLiveScreen","read-all","markRead","tab","unread","lastUpdated",
 "m26(locale","inboxIsValid","router.push","accessibilityRole","RefreshControl"],"inbox");
has(more,["vibrationKeyFor","m26(locale","signOut","security","/profile"],"account");
has(data,["noticeScope","vibrationKeyFor","alertIsNew","canVibrate","inboxIsValid"],"account scoping");
has(badge,["fetchIdentity","noticeScope","initialized=false","AppState","Vibration",
 "vibrationKeyFor","inboxIsValid"],"foreground-only notification");
has(banner,["probeConnection","useConnectionStatus","retryConnection"],"offline notice");
has(network,["observedFetch","AbortController","15000","probeConnection"],"transport tracking");
has(server,["/notifications/read-all","notificationScope(scope)","isNull(staffNotification.readAt)"],"RBAC bulk read");
has(apiCI,["/notifications/read-all","kitchen","owner","unread","idempotent"],"server test");
for(const source of [unit,copy])assert.ok(source.includes("ps-AF")&&source.includes("fa-AF"),"Three locales required");
assert.ok(!badge.includes("expo-notifications")&&!network.includes("queue.push("),
 "P26 must not pretend to deliver OS push or automatically queue writes offline.");
const workflow=text(".github/workflows/verify.yml");
assert.ok(workflow.includes("mobile26:verify")&&workflow.includes("phase26-ci.ts"),"P26 CI missing");
console.info("PASS P26 static contracts: secure inbox, scoped opt-in, foreground-only polling, no offline mutation replays and CI.");
