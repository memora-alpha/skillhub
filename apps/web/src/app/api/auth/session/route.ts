import { authGateway } from "@/lib/auth/server";
import type { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function handler(request: NextRequest) {
  return authGateway(request);
}
export { handler as GET, handler as POST, handler as DELETE };
