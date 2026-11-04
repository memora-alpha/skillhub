import type { NextRequest } from "next/server";
import { authGateway } from "@/lib/auth/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function POST(request: NextRequest) {
  return authGateway(request, true);
}
