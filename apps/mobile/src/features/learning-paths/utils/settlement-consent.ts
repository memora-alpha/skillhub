import { AppError } from "@/lib/http/errors";
import type { createPathChangesApi } from "../api/path-changes-api";
import type { SettlementStatus } from "../api/path-changes-contract";

export function canConsentToSettlement(status: SettlementStatus) {
  return (
    !!status.pathVersion &&
    !!status.immediateSettlement?.canApprove &&
    !status.immediateSettlement.ownApprovedAt &&
    ["WAITING_DISPUTE_WINDOW", "READY", "RETRYING", "NEEDS_REVIEW"].includes(
      status.status,
    )
  );
}

// Every send/retry is an explicit financial decision. Reads never replay it.
export async function submitSettlementConsent(
  api: Pick<
    ReturnType<typeof createPathChangesApi>,
    "settlement" | "approveSettlement"
  >,
  snapshot: SettlementStatus,
) {
  const fresh = await api.settlement(snapshot.pathId);
  if (fresh.pathVersion !== snapshot.pathVersion)
    throw new AppError("http", 409, "STALE_PATH_VERSION");
  if (fresh.status === "SETTLED" || fresh.immediateSettlement?.ownApprovedAt)
    return { kind: "observed" as const };
  if (!canConsentToSettlement(fresh))
    throw new AppError("http", 409, "SETTLEMENT_CONSENT_NOT_ALLOWED");
  const receipt = await api.approveSettlement(fresh.pathId, fresh.pathVersion!);
  return { kind: "submitted" as const, receipt };
}
