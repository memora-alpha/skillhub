import { AppError } from "@/lib/http/errors";
import { isRecord } from "@/lib/http/response";
import { creditAmount } from "../utils/amount";
import type { WalletSnapshot } from "../types/wallet";

// Public WalletView at BE17e3ac1. Scope is captured by the caller, not the DTO.
export function parseWalletSnapshot(value: unknown): WalletSnapshot {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.walletVersion) ||
    (value.walletVersion as number) < 0
  )
    throw new AppError("protocol");
  try {
    return {
      availableCredit: creditAmount(value.availableCredit),
      heldCredit: creditAmount(value.heldCredit),
      walletVersion: value.walletVersion as number,
    };
  } catch {
    throw new AppError("protocol");
  }
}
