import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import {
  FeaturePage,
  Panel,
  Copy,
  Metric,
  RouteButton,
} from "@/components/feature-page";
import { useMaterialsPreview } from "../context";
export function MaterialPurchaseScreen() {
  const { id, changed } = useLocalSearchParams<{
    id: string;
    changed?: string;
  }>();
  const { materials, library } = useMaterialsPreview();
  const m = materials.find((i) => i.id === id);
  const [acceptedSnapshot, setAcceptedSnapshot] = useState(changed !== "1");
  return (
    <FeaturePage title="Xác nhận mua tài liệu" back={`/materials/${id}`}>
      {!m ||
      m.status !== "PUBLISHED" ||
      m.access !== "PAID" ||
      m.owner === "me" ? (
        <EmptyState
          title="Không thể mua tài liệu này"
          description="Chỉ mua tài liệu trả phí đã công bố của người khác."
        />
      ) : library[id] ? (
        <Panel title="Bạn đã có quyền truy cập">
          <Copy>Không thu tiền lần thứ hai cho tài liệu đã mua.</Copy>
          <RouteButton href={`/materials/${id}/access`}>
            Mở tài liệu mẫu
          </RouteButton>
        </Panel>
      ) : (
        <Panel title={m.title}>
          {!acceptedSnapshot && (
            <>
              <FormNotice tone="info">
                Giá hoặc phiên bản đã thay đổi. Kiểm tra snapshot hiện tại trước
                khi tiếp tục.
              </FormNotice>
              <Button variant="paper" onPress={() => setAcceptedSnapshot(true)}>
                Tôi đã xem giá & phiên bản mới
              </Button>
            </>
          )}
          <Metric label="Giá hiện tại" value={`${m.price} CR`} />
          <Copy>Phiên bản sẽ mua: {m.version}</Copy>
          <Copy>
            Credit dùng từ số dư khả dụng, riêng với thỏa thuận học. Quyền truy
            cập gắn phiên bản đã mua.
          </Copy>
          <Button disabled onPress={() => undefined}>
            Xác nhận mua
          </Button>
          <FormNotice tone="info">
            Luồng mua chưa được bật: cần chính sách phí tài liệu được chốt và
            dịch vụ thanh toán Credit. Bản xem thử không thu tiền hoặc tạo quyền
            mua.
          </FormNotice>
          <RouteButton secondary href="/materials/library">
            Xem thư viện có quyền mẫu
          </RouteButton>
        </Panel>
      )}
    </FeaturePage>
  );
}
