/**
 * DineFlow Expo Go launcher. Starts or reuses an ngrok HTTPS tunnel to
 * localhost:4000 before starting Metro, all from "pnpm dev:mobile".
 * Does not modify .env files or expose credentials.
 */
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const mobileDirectory=resolve(repositoryRoot,"apps/mobile");
const inspector="http://127.0.0.1:4040/api/tunnels";
const API_PORT=4000;
const pause=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

function localPort(value){
 if(typeof value!=="string")return null;
 const input=value.trim();
 if(/^\d{1,5}$/.test(input))return Number(input);
 let url;
 try{url=new URL(input.includes("://")?input:"http://"+input);}catch{return null;}
 const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,"");
 if(!["localhost","127.0.0.1","::1"].includes(host))return null;
 return Number(url.port||(url.protocol==="https:"?"443":"80"));
}

/** Only trust HTTPS endpoints actually forwarding to our development API. */
export function findApiTunnel(payload,port=API_PORT){
 if(!payload||!Array.isArray(payload.tunnels))return null;
 for(const tunnel of payload.tunnels){
  if(!tunnel||localPort(tunnel.config?.addr)!==port)continue;
  try{
   const url=new URL(tunnel.public_url);
   if(url.protocol!=="https:"||url.username||url.password||
      url.pathname!=="/"||url.search||url.hash)continue;
   return url.origin;
  }catch{/* Skip malformed agent responses. */}
 }
 return null;
}

export function expoEnvironment(apiUrl,baseEnv=process.env){
 // Explicit process environment wins over .env for this Metro invocation;
 // keep the user's other Expo public settings intact.
 return {...baseEnv,EXPO_PUBLIC_API_URL:apiUrl};
}

export function expoArguments(argv=[]){
 if(argv.length===0)return ["start","--tunnel","--clear","--go"];
 if(argv.length===1&&argv[0]==="--lan")return ["start","--lan","--clear","--go"];
 throw new Error("Use pnpm dev:mobile (Expo tunnel) or pnpm dev:mobile:lan (Expo LAN).");
}

async function agentApiUrl(fetchImpl=globalThis.fetch){
 try{
  const response=await fetchImpl(inspector,{signal:AbortSignal.timeout(1200)});
  if(!response.ok)return null;
  return findApiTunnel(await response.json());
 }catch{return null;}
}

async function requireApi(fetchImpl=globalThis.fetch){
 try{
  const response=await fetchImpl("http://127.0.0.1:4000/api/health",{
   signal:AbortSignal.timeout(2000)
  });
  if(response.ok)return;
 }catch{/* Give one clear actionable message below. */}
 throw new Error("DineFlow API is not reachable on port 4000. Start pnpm dev:api in another terminal first.");
}

async function waitForTunnel(child,exitState,{lookup=agentApiUrl,tries=35}={}){
 for(let i=0;i<tries;i++){
  if(exitState.failed)throw new Error(exitState.failed);
  if(exitState.exited)throw new Error("ngrok exited before opening the API tunnel.");
  const url=await lookup();
  if(url)return url;
  await pause(750);
 }
 throw new Error("ngrok did not expose an HTTPS tunnel to port 4000 through the local agent API (4040). Check ngrok authentication, account endpoint limits, or an already running agent.");
}

function ngrokErrorMessage(raw){
 const code=raw.match(/ERR_NGROK_\d+/)?.[0];
 return code?("ngrok could not start ("+code+"). Check ngrok agent credentials and existing active endpoints."):
  "ngrok could not start. Confirm ngrok is installed, signed in, and no endpoint is already running.";
}

export async function runMobile(argv=process.argv.slice(2),deps={}){
 const output=deps.output??console;
 const fetchImpl=deps.fetchImpl??globalThis.fetch;
 const spawnImpl=deps.spawnImpl??spawn;
 const mode=expoArguments(argv);
 const expoCli=resolve(mobileDirectory,"node_modules/expo/bin/cli");
 if(!existsSync(expoCli))throw new Error("Expo CLI is missing. Run pnpm install from the restaurant project folder.");

 await requireApi(fetchImpl);
 let url=await agentApiUrl(fetchImpl);
 let ownedNgrok=null;
 const ngrokExit={exited:false,failed:""};
 let expo=null;
 let stopping=false;
 const terminate=()=>{
  if(stopping)return;
  stopping=true;
  expo?.kill();
  ownedNgrok?.kill();
 };
 const onInterrupt=()=>terminate();
 process.on("SIGINT",onInterrupt);
 process.on("SIGTERM",onInterrupt);
 try{
  if(url){
   output.log("[DineFlow] Reusing an existing ngrok HTTPS tunnel for API port 4000.");
  }else{
   output.log("[DineFlow] Starting ngrok http 4000 (managed with Expo).");
   ownedNgrok=spawnImpl(process.platform==="win32"?"ngrok.exe":"ngrok",["http","4000"],{
    cwd:repositoryRoot,stdio:["ignore","ignore","pipe"],windowsHide:true
   });
   let ngrokOutput="";
   ownedNgrok.stderr?.on("data",chunk=>{
    ngrokOutput=(ngrokOutput+chunk.toString()).slice(-4096);
   });
   ownedNgrok.on("error",()=>{
    ngrokExit.failed="Cannot launch ngrok. Install the ngrok CLI, run ngrok config add-authtoken, and check that it is on PATH.";
   });
   ownedNgrok.on("exit",()=>{
    ngrokExit.exited=true;
    if(!stopping&&!ngrokExit.failed)ngrokExit.failed=ngrokErrorMessage(ngrokOutput);
   });
   url=await waitForTunnel(ownedNgrok,ngrokExit,{
    lookup:()=>agentApiUrl(fetchImpl)
   });
  }
  if(stopping)return;
  output.log("[DineFlow] API tunnel: "+url);
  output.log("[DineFlow] Using EXPO_PUBLIC_API_URL for this Expo run; apps/mobile/.env is unchanged.");
  output.log("[DineFlow] Expo Go: "+(mode.includes("--lan")?"LAN":"tunnel")+" mode. Press Ctrl+C to stop Expo and the API ngrok tunnel.");
  const environment=expoEnvironment(url,process.env);
  expo=spawnImpl(process.execPath,[expoCli,...mode],{
   cwd:mobileDirectory,stdio:"inherit",env:environment,windowsHide:false
  });
  const result=await new Promise((resolve,reject)=>{
   expo.once("error",reject);
   expo.once("exit",(code,signal)=>resolve({code,signal}));
  });
  if(!stopping&&result.code!==0){
   output.error("[DineFlow] Expo exited. If its own tunnel conflicts with ngrok, use pnpm dev:mobile:lan while the phone is on the same Wi-Fi.");
   process.exitCode=result.code??1;
  }
 }finally{
  terminate();
  process.removeListener("SIGINT",onInterrupt);
  process.removeListener("SIGTERM",onInterrupt);
 }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 runMobile().catch(error=>{
  // Never output raw ngrok process logs (may contain environment details).
  console.error("[DineFlow] "+(error instanceof Error?error.message:"Mobile launcher failed."));
  process.exitCode=1;
 });
}
