import {NextResponse,type NextRequest} from "next/server";
import {isWrongRoleRoute} from "./lib/phase43-route-gates";

/**
 * Next.js 16 Proxy runs ahead of App Router streaming. The plain 404 is only
 * for invalid *route shapes*; valid app shells still use Better Auth identity
 * and tenant-scoped API policy before accessing any business information.
 */
export function proxy(request:NextRequest){
 if(isWrongRoleRoute(request.nextUrl.pathname)){
  return new NextResponse("Not Found",{
   status:404,
   headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff"}
  });
 }
 return NextResponse.next();
}
export const config={
 matcher:["/:area/:section/:path*"]
};
