import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { FlowSection } from "@/components/learning-flow";
import { useConnections } from "@/features/connections";
import type { TerminationQuote } from "../api/termination-quote-contract";
import { terminationQuoteNotes } from "../utils/termination-quote-summary";
import { useTerminationQuote } from "../hooks/use-termination-quote";
import { PathReadFeedback } from "./PathReadFeedback";

export function TerminationCreditPreview({
  pathId,
}: Readonly<{ pathId: string }>) {
  const query = useTerminationQuote(pathId);
  return (
    <FlowSection title="Credit dự kiến khi hủy">
      <PathReadFeedback query={query} />
      {query.error && query.data && (
        <Copy size="hint">
          Bản dự kiến chưa được cập nhật. Kéo xuống để tải lại.
        </Copy>
      )}
      {!query.data && !query.error && !query.isLoading && (
        <Copy size="hint">Kết nối mạng để xem Credit dự kiến.</Copy>
      )}
      {query.data && !query.denied && (
        <TerminationQuoteDetails quote={query.data} />
      )}
    </FlowSection>
  );
}

export function TerminationQuoteDetails({
  quote,
}: Readonly<{ quote: TerminationQuote }>) {
  const runtime = useConnections();
  const notes = terminationQuoteNotes(quote.reasonCodes);
  return (
    <>
      <Copy size="hint">
        Đã hoàn thành {quote.completedSessions}/{quote.totalSessions} buổi
      </Copy>
      {quote.allocations.map((allocation) => (
        <FlowSection
          key={allocation.allocationId}
          title={
            allocation.userId === runtime.userId
              ? "Khoản của bạn"
              : "Khoản của đối tác"
          }
        >
          <Copy>Hoàn lại: {allocation.refund} CR</Copy>
          <Copy size="hint">
            Chuyển đối tác: {allocation.counterpartyPayment} CR · Phí:{" "}
            {allocation.platformFee} CR
          </Copy>
          {!/^0(?:\.0+)?$/.test(allocation.compensationCredit) && (
            <Copy size="hint">
              Trong khoản chuyển có {allocation.compensationCredit} CR bồi hoàn
              theo kết luận vắng mặt.
            </Copy>
          )}
        </FlowSection>
      ))}
      {notes.length > 0 && (
        <FormNotice tone="warning" compact>
          {notes.join(" ")}
        </FormNotice>
      )}
      <Copy size="hint">
        Tạm tính theo dữ liệu hiện tại. Credit chỉ được xử lý khi đủ điều kiện
        quyết toán.
      </Copy>
    </>
  );
}
