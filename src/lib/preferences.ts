import { cookies } from "next/headers";

export async function getLowData() {
  return (await cookies()).get("low_data")?.value === "1";
}
