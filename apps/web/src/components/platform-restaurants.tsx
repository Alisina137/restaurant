"use client";
import {PlatformTenants,PlatformTenantDetail} from "./phase12-platform";
export function PlatformRestaurants({id}:{id?:string}){
 return id?<PlatformTenantDetail id={id}/>:<PlatformTenants/>;
}
