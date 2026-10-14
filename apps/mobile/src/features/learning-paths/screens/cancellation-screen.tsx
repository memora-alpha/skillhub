import { useState } from "react";
import { learningRoutes } from "@/constants/navigation";
import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { DataForm, textRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { usePathsPreview } from "../context";
export function PathCancellationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paths, save } = usePathsPreview();
  const path = paths.find((p) => p.id === id);
  const [draft, setDraft] = useState<{ reason: string; at: string }>();
  return (
    <FeaturePage title="Hủy / dừng lộ trình" back={`/paths/${id}`}>
      {!path ? (
        <EmptyState
          title="Không tìm thấy lộ trình"
          description="Chọn một lộ trình của bạn."
        />
      ) : path.status === "CANCELLED" ? (
        <Panel title="Lộ trình mẫu đã hủy">
          <Copy>Hủy trước khi giữ Credit không tạo quyết toán hoàn thành.</Copy>
          {path.cancellation && (
            <>
              <Copy>
                Người hủy: bạn ·{" "}
                {new Date(path.cancellation.at).toLocaleString("vi-VN")}
              </Copy>
              <Copy>Lý do: {path.cancellation.reason}</Copy>
            </>
          )}
          <RouteButton href={learningRoutes.paths}>
            Danh sách lộ trình
          </RouteButton>
        </Panel>
      ) : !["PROPOSED", "ACTIVE"].includes(path.status) ? (
        <EmptyState
          title="Không thể hủy ở trạng thái này"
          description="Theo dõi xử lý tranh chấp hoặc kết quả lộ trình."
        />
      ) : (
        <>
          <Panel title={path.title}>
            <Copy>
              {path.status === "PROPOSED"
                ? "Thỏa thuận chưa giữ Credit. Bạn có thể hủy bản xem thử trước khi bắt đầu."
                : "Thỏa thuận đã giữ Credit. Phí hủy, số tiền hoàn trả và thời hạn cần chính sách được cấu hình."}
            </Copy>
            <FormNotice tone="info">
              Không dùng mức quyết toán 96%/4% của lộ trình hoàn thành để tính
              tiền hủy. Bản xem thử không hoàn Credit hoặc trừ uy tín.
            </FormNotice>
            {draft ? (
              <>
                <Copy>
                  Người đề nghị: bạn ·{" "}
                  {new Date(draft.at).toLocaleString("vi-VN")}
                </Copy>
                <Copy>Lý do: {draft.reason}</Copy>
                <Copy muted>
                  Nội dung chỉ được lưu tại màn hình xem thử này. Lộ trình và
                  lịch học vẫn có hiệu lực; chưa gửi yêu cầu xử lý thật.
                </Copy>
              </>
            ) : (
              <DataForm
                fields={[
                  {
                    name: "reason",
                    label: "Lý do hủy / dừng",
                    multiline: true,
                    rule: textRule(10, 1000),
                  },
                ]}
                submitLabel={
                  path.status === "PROPOSED"
                    ? "Xác nhận hủy lộ trình mẫu"
                    : "Xem thử nội dung đề nghị dừng"
                }
                onSubmit={(v) => {
                  if (path.status === "PROPOSED")
                    save({
                      ...path,
                      status: "CANCELLED",
                      cancellation: {
                        actor: "me",
                        reason: v.reason!,
                        at: new Date().toISOString(),
                      },
                    });
                  else
                    setDraft({
                      reason: v.reason!,
                      at: new Date().toISOString(),
                    });
                }}
              />
            )}
          </Panel>
          {path.status === "ACTIVE" && (
            <>
              <RouteButton secondary href={`/paths/${id}/sessions`}>
                Chọn buổi học để đổi lịch / báo cáo vắng mặt
              </RouteButton>
              <Copy muted>
                No-show cần ghi nhận người liên quan, thời điểm và lý do trong
                báo cáo. Vi phạm và chế tài do hệ thống xác minh.
              </Copy>
            </>
          )}
        </>
      )}
    </FeaturePage>
  );
}
