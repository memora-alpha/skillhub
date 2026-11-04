import type { NextRequest } from "next/server";
import { accountGateway } from "@/lib/auth/account";
export const dynamic = "force-dynamic";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string[] }> },
) {
  return accountGateway(request, (await context.params).action);
}
