import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { usePathsPreview } from "../context";
export function SettlementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paths } = usePathsPreview();
  const path = paths.find((p) => p.id === id);
  return (
    <FeaturePage title="Quyết toán cuối lộ trình" back={`/paths/${id}`}>
      {!path || path.status !== "COMPLETED" ? (
        <EmptyState
          title="Chưa có kết quả quyết toán"
          description="Cần tất cả buổi học hoàn thành và không còn tranh chấp giữ quyết toán."
        />
      ) : (
        <>
          <Panel title="Hành trình đã hoàn thành" accent>
            <Copy>{path.title}</Copy>
            <Copy>
              {path.type === "TWO_WAY"
                ? "Mỗi người nhận lại 96% khoản tạm giữ của chính mình. Phí nền tảng 4%."
                : "Người dạy nhận 96% giá toàn lộ trình. Phí nền tảng 4%; người học không được hoàn lại giá dạy."}
            </Copy>
            {path.id === "path-completed" && (
              <Copy>
                Snapshot mẫu: người học trả 100 CR → người dạy nhận 96 CR · phí
                4 CR.
              </Copy>
            )}
            {path.id === "path-completed-two-way" && (
              <Copy>
                Snapshot mẫu: mỗi người giữ 40 CR → nhận lại 38.40 CR vào ví của
                chính mình · phí 1.60 CR/người.
              </Copy>
            )}
            <Copy muted>
              Kết quả số tiền và làm tròn thực tế phải lấy từ sổ cái backend.
              Hoàn thành từng buổi không tạo quyết toán riêng.
            </Copy>
          </Panel>
          <RouteButton href={`/paths/${id}/review`}>
            Đánh giá người trao đổi
          </RouteButton>
          <RouteButton secondary href="/wallet/history">
            Xem giao dịch mẫu
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
