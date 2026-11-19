/**
 * Normalize Drizzle's wrapped pg errors into safe, actionable menu responses.
 * Do not return raw SQL, connection strings, table names, or stack traces.
 */
type DbFailure={status:number;code:string;message:string};
function detail(error:unknown):{code:string;constraint:string}{
 let current:unknown=error;
 for(let level=0;level<5;level++){
  if(!current||typeof current!=="object")break;
  const value=current as {code?:unknown;constraint?:unknown;cause?:unknown};
  const code=typeof value.code==="string"?value.code:"";
  const constraint=typeof value.constraint==="string"?value.constraint:"";
  if(code==="23505"||code==="42P01"||code==="42703"||code==="3D000"||
    code.startsWith("08")||code==="ECONNRESET"||code==="ETIMEDOUT"||
    code==="ENOTFOUND"||code==="ECONNREFUSED")return {code,constraint};
  current=value.cause;
 }
 return {code:"",constraint:""};
}
export function classifyMenuDbError(error:unknown,production=process.env.NODE_ENV==="production"):DbFailure{
 const {code,constraint}=detail(error);
 if(code==="23505"){
  const kind=constraint.toLowerCase();
  const label=kind.includes("sku")?"DUPLICATE_SKU":
   kind.includes("category_active_name")?"DUPLICATE_CATEGORY":"DUPLICATE";
  return {status:409,code:label,message:label==="DUPLICATE_CATEGORY"?
   "A category with this Dari name already exists. Choose a different name.":
   "A menu entry with these unique details already exists."};
 }
 if(code==="42P01"||code==="42703"){
  return {status:503,code:"MENU_SCHEMA_OUTDATED",message:production?
   "The menu service is temporarily unavailable.":
   "Menu database tables or columns are missing. Run pnpm db:migrate and restart pnpm dev:api."};
 }
 if(code==="3D000"||code.startsWith("08")||code==="ECONNRESET"||code==="ECONNREFUSED"||
  code==="ETIMEDOUT"||code==="ENOTFOUND"){
  return {status:503,code:"DATABASE_UNAVAILABLE",message:
   "Cannot reach the restaurant database. Check the database connection and retry."};
 }
 return {status:503,code:"SERVICE_UNAVAILABLE",message:"Could not save the menu. Please retry."};
}
