import { Copy, RouteButton } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import {
  terminationResolution,
  type TerminationRequest,
} from "../api/path-changes-contract";

export function TerminationDecision({
  request,
}: Readonly<{ request: TerminationRequest }>) {
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
        <Copy key={allocation.allocationId}>
          Khoản tạm giữ {index + 1}: hoàn cho chủ khoản {allocation.refund} CR ·
          chuyển đối tác {allocation.counterpartyPayment} CR · phí nền tảng{" "}
          {allocation.platformFee} CR.
        </Copy>
      ))}
      <Copy size="hint">Xem giao dịch ví để biết phần Credit của bạn.</Copy>
      <RouteButton secondary href="/wallet/history">
        Xem giao dịch ví
      </RouteButton>
    </>
  );
}
