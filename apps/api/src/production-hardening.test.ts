import test from "node:test";
import assert from "node:assert/strict";
import {createWindowLimiter,validateProductionEnvironment} from "./production-hardening";

test("rate limit allows exactly max events, returns Retry-After, then resets",()=>{
 let now=10_000;
 const check=createWindowLimiter(2,10_000,()=>now,2);
 assert.equal(check("A").allowed,true);
 assert.equal(check("A").allowed,true);
 assert.deepEqual(check("A"),{allowed:false,retryAfter:10});
 assert.equal(check("B").allowed,true);
 assert.equal(check("C").allowed,false,"bounded memory fails closed against key floods");
 now+=10_001;
 assert.equal(check("A").allowed,true);
 assert.equal(check("C").allowed,true,"expired buckets are reclaimed");
});
test("local development does not require production-only services",()=>{
 assert.doesNotThrow(()=>validateProductionEnvironment({NODE_ENV:"development"} as NodeJS.ProcessEnv));
});
test("production refuses missing secrets, insecure origins and console email",()=>{
 assert.throws(()=>validateProductionEnvironment({NODE_ENV:"production"} as NodeJS.ProcessEnv),/missing/);
 const config={NODE_ENV:"production",DATABASE_URL:"postgresql://db.example/database",
  BETTER_AUTH_SECRET:"minimum-secret-length-over-32-characters",
  BETTER_AUTH_URL:"https://api.example.com",PUBLIC_WEB_URL:"https://example.com",
  TRUSTED_ORIGINS:"https://example.com",RESEND_API_KEY:"dummy",MAIL_FROM:"no-reply@example.com",
  MEDIA_LOCAL_DIR:"/srv/restaurant/media"} as NodeJS.ProcessEnv;
 assert.doesNotThrow(()=>validateProductionEnvironment(config));
 assert.throws(()=>validateProductionEnvironment({...config,PUBLIC_WEB_URL:"http://localhost:3000"}),/HTTPS/);
 assert.throws(()=>validateProductionEnvironment({...config,TRUSTED_ORIGINS:"https://*.example.com"}),/HTTPS/);
 assert.throws(()=>validateProductionEnvironment({...config,DEV_EMAIL_DELIVERY:"console"}),/Development email/);
 assert.throws(()=>validateProductionEnvironment({...config,TRUST_PROXY_HOPS:"7"}),/TRUST_PROXY_HOPS/);
});
