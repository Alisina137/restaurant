import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {findApiTunnel,expoEnvironment,expoArguments} from "./dev-mobile-with-ngrok.mjs";

const valid={tunnels:[
 {proto:"https",public_url:"https://other.ngrok-free.app",config:{addr:"http://localhost:8081"}},
 {proto:"http",public_url:"http://ours.ngrok-free.app",config:{addr:"localhost:4000"}},
 {proto:"https",public_url:"https://ours.ngrok-free.app",config:{addr:"http://127.0.0.1:4000"}}
]};
test("selects only a HTTPS tunnel that forwards to the backend port 4000",()=>{
 assert.equal(findApiTunnel(valid),"https://ours.ngrok-free.app");
 assert.equal(findApiTunnel({tunnels:[{public_url:"https://api.ngrok.app",config:{addr:"4000"}}]}),
  "https://api.ngrok.app");
 assert.equal(findApiTunnel({tunnels:[{public_url:"https://api.ngrok.app",config:{addr:"http://[::1]:4000"}}]}),
  "https://api.ngrok.app");
});
test("ignores wrong ports and unsafe malformed ngrok inspector responses",()=>{
 assert.equal(findApiTunnel(null),null);
 assert.equal(findApiTunnel({tunnels:[]}),null);
 for(const bad of [
  {public_url:"http://bad.ngrok.app",config:{addr:"4000"}},
  {public_url:"https://user:secret@bad.ngrok.app",config:{addr:"4000"}},
  {public_url:"https://bad.ngrok.app/token",config:{addr:"4000"}},
  {public_url:"https://bad.ngrok.app?auth=secret",config:{addr:"4000"}},
  {public_url:"https://bad.ngrok.app",config:{addr:"http://remote.example:4000"}},
  {public_url:"https://bad.ngrok.app",config:{addr:"http://localhost:14000"}},
  {public_url:"https://bad.ngrok.app",config:{addr:"localhost:80"}}
 ])assert.equal(findApiTunnel({tunnels:[bad]}),null,JSON.stringify(bad));
});
test("sets ephemeral EXPO_PUBLIC_API_URL but preserves other environment variables",()=>{
 const env={EXPO_PUBLIC_API_URL:"http://localhost:4000",EXPO_PUBLIC_WEB_URL:"https://web.example",TEST_FLAG:"ok"};
 const next=expoEnvironment("https://ours.ngrok-free.app",env);
 assert.equal(next.EXPO_PUBLIC_API_URL,"https://ours.ngrok-free.app");
 assert.equal(next.EXPO_PUBLIC_WEB_URL,env.EXPO_PUBLIC_WEB_URL);
 assert.equal(next.TEST_FLAG,env.TEST_FLAG);
 assert.equal(env.EXPO_PUBLIC_API_URL,"http://localhost:4000");
});
test("preserves Expo tunnel mode, offers LAN mode, rejects unsupported CLI flags",()=>{
 assert.deepEqual(expoArguments(),["start","--tunnel","--clear","--go"]);
 assert.deepEqual(expoArguments(["--lan"]),["start","--lan","--clear","--go"]);
 assert.throws(()=>expoArguments(["--port","4000"]));
});
test("root pnpm dev:mobile and LAN scripts use managed tunnel launcher",()=>{
 const scripts=JSON.parse(readFileSync(resolve("package.json"),"utf8")).scripts;
 assert.equal(scripts["dev:mobile"],"node scripts/dev-mobile-with-ngrok.mjs");
 assert.equal(scripts["dev:mobile:lan"],"node scripts/dev-mobile-with-ngrok.mjs --lan");
});
