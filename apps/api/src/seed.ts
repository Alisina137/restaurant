import "dotenv/config";
import {auth,pool} from "./auth.js";
if(process.env.NODE_ENV==="production")throw Error("Development seed forbidden in production");
const password=process.env.DEMO_PASSWORD;
if(!password||password.length<12)throw Error("Set a local DEMO_PASSWORD with at least 12 characters");
await pool.query("INSERT INTO restaurants(id,name,slug) VALUES('demo-restaurant','Demo Restaurant','demo-restaurant') ON CONFLICT DO NOTHING");
for(const [name,email,role] of [
 ["Demo Waiter","waiter@demo.dineflow.local","WAITER"],
 ["Demo Cashier","cashier@demo.dineflow.local","CASHIER"],
 ["Demo Platform Admin","platform@demo.dineflow.local","PLATFORM_ADMIN"]
]) {
 let id:string;
 try{id=(await auth.api.signUpEmail({body:{name,email,password}})).user.id;}
 catch{const r=await pool.query('SELECT id FROM "user" WHERE email=$1',[email]);if(!r.rowCount)throw Error("Account setup failed: "+email);id=r.rows[0].id;}
 if(role==="PLATFORM_ADMIN")await pool.query("INSERT INTO platform_admins(user_id) VALUES($1) ON CONFLICT DO NOTHING",[id]);
 else await pool.query("INSERT INTO memberships(user_id,restaurant_id,role) VALUES($1,'demo-restaurant',$2) ON CONFLICT DO NOTHING",[id,role]);
 console.log("Ready:",email,role);
}
await pool.end();
