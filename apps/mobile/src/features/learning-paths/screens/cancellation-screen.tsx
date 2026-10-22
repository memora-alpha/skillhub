import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { FlowPage } from "@/components/learning-flow";

export function PathCancellationScreen() {
  return (
    <FlowPage
      title="Hủy / dừng lộ trình"
      demo={false}
      back="/my-learning?tab=paths"
    >
      <FormNotice tone="info">
        Mobile chưa có API yêu cầu hủy hoặc dừng lộ trình. Màn này không gửi yêu
        cầu và không thay đổi trạng thái lộ trình.
      </FormNotice>
      <EmptyState
        title="Chưa thể hủy lộ trình"
        description="Trạng thái, lý do và xử lý Credit phải được xác nhận bởi API của hệ thống."
      />
    </FlowPage>
  );
}
