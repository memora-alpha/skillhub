import { Copy, RouteButton } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { useConnections } from "@/features/connections";
import { TerminationCreditAmounts } from "./termination-credit-amounts";
import {
  terminationResolution,
  type TerminationRequest,
} from "../api/path-changes-contract";

export function TerminationDecision({
  request,
}: Readonly<{ request: TerminationRequest }>) {
  const runtime = useConnections();
  const decision = terminationResolution.safeParse(request.resolution);
  if (request.status === "REJECTED" && request.resolution)
    return <Copy>Lý do quyết định: {request.resolution.reason}</Copy>;
  if (request.status !== "APPLIED" || !decision.success) return null;
  return (
    <>
      <FormNotice tone="success" compact>
        Đã hủy lộ trình và xử lý Credit.
      </FormNotice>
      <Copy>Lý do quyết định: {decision.data.reason}</Copy>
      {decision.data.allocations.map((allocation, index) => (
        <TerminationCreditAmounts
          key={allocation.allocationId}
          title={
            allocation.userId
              ? allocation.userId === runtime.userId
                ? "Khoản của bạn"
                : "Khoản của đối tác"
              : `Khoản tạm giữ ${index + 1}`
          }
          refundLabel="Hoàn cho chủ khoản"
          refund={allocation.refund}
          counterpartyPayment={allocation.counterpartyPayment}
          platformFee={allocation.platformFee}
        />
      ))}
      <Copy size="hint">Xem giao dịch ví để biết phần Credit của bạn.</Copy>
      <RouteButton secondary href="/wallet/history">
        Xem giao dịch ví
      </RouteButton>
    </>
  );
}
