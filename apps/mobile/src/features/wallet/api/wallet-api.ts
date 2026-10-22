import type { HttpClient } from "@/lib/http/client";
import { parseWalletSnapshot } from "../schemas/wallet-contracts";

export function createWalletApi(client: Pick<HttpClient, "request">) {
  return {
    read: async (signal: AbortSignal) =>
      parseWalletSnapshot(
        await client.request("/me/wallet", {
          method: "GET",
          authenticated: true,
          signal,
        }),
      ),
  };
}
