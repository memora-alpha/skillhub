import type { NextRequest } from "next/server";
import { staffGateway } from "@/lib/staff/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handler(request: NextRequest, context: Context) {
  return staffGateway(request, (await context.params).path, "admin");
}
export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
