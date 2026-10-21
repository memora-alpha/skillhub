import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { FlowPage } from "@/components/learning-flow";

export function SettlementScreen() {
  return (
    <FlowPage
      title="Quyết toán cuối lộ trình"
      demo={false}
      back="/my-learning?tab=paths"
    >
      <FormNotice tone="info">
        Mobile chưa có API quyết toán lộ trình. Chưa có giao dịch hay khoản tiền
        nào được tính hoặc cập nhật từ màn này.
      </FormNotice>
      <EmptyState
        title="Chưa thể xem quyết toán"
        description="Kết quả cần được tải từ sổ cái và API quyết toán của hệ thống."
      />
    </FlowPage>
  );
}
