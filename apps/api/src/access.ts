import {pool} from "./auth.js";
import {roles,type Role} from "@dineflow/core";
export type Membership={role:Role;restaurantId:string|null};
export async function accessFor(userId:string):Promise<Membership[]>{
 const global=await pool.query("SELECT user_id FROM platform_admins WHERE user_id=$1",[userId]);
 const memberships=await pool.query("SELECT restaurant_id,role FROM memberships WHERE user_id=$1 AND status='ACTIVE'",[userId]);
 const list:Membership[]=global.rowCount?[{role:"PLATFORM_ADMIN",restaurantId:null}]:[];
 for(const m of memberships.rows)if(roles.includes(m.role))list.push({role:m.role,restaurantId:m.restaurant_id});
 return list;
}
export const authorized=(memberships:Membership[],tenantId:string,rolesAllowed:Role[])=>memberships.some(m=>m.restaurantId===tenantId&&rolesAllowed.includes(m.role));
