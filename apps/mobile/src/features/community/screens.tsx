import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
import { DataForm, textRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  Metric,
  RouteButton,
} from "@/components/feature-page";
import { usePathsPreview } from "@/features/learning-paths";
export function ReviewEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paths, save } = usePathsPreview();
  const path = paths.find((p) => p.id === id);
  return (
    <FeaturePage title="Đánh giá cuối Learning Path" back={`/paths/${id}`}>
      {!path || path.status !== "COMPLETED" ? (
        <EmptyState
          title="Chưa thể đánh giá"
          description="Đánh giá chỉ mở sau khi toàn bộ Learning Path hoàn thành."
        />
      ) : path.reviewed ? (
        <Panel title="Đã gửi đánh giá mẫu">
          <Copy>
            {path.review?.rating}/5 sao · {path.review?.comment}
          </Copy>
          <Copy muted>
            Mỗi người đánh giá người trao đổi một lần cho mỗi Learning Path.
          </Copy>
        </Panel>
      ) : (
        <Panel title={`Chia sẻ trải nghiệm với ${path.partner}`}>
          <DataForm
            fields={[
              {
                name: "rating",
                label: "Đánh giá của bạn",
                rule: z
                  .string()
                  .refine((v) => /^[1-5]$/.test(v), "Chọn 1–5 sao."),
                choices: ["1", "2", "3", "4", "5"],
              },
              {
                name: "comment",
                label: "Điều bạn muốn chia sẻ",
                rule: textRule(0, 1000),
                multiline: true,
              },
            ]}
            submitLabel="Gửi đánh giá mẫu"
            onSubmit={(v) =>
              save({
                ...path,
                reviewed: true,
                review: { rating: Number(v.rating), comment: v.comment! },
              })
            }
          />
          <Copy muted>
            Điểm uy tín và Credit thưởng, nếu có, do hệ thống quyết định. Bản
            xem thử không tự cộng điểm.
          </Copy>
        </Panel>
      )}
    </FeaturePage>
  );
}
export function ReviewsScreen() {
  const { paths } = usePathsPreview();
  const [tab, setTab] = useState("Tôi đánh giá");
  const items = paths.filter((p) => p.status === "COMPLETED");
  return (
    <FeaturePage title="Đánh giá" back="/profile">
      <ChoiceGroup
        label="Đánh giá Learning Path"
        options={["Tôi đánh giá", "Đánh giá nhận được"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Đánh giá nhận được" ? (
        <Panel title="Hồng Anh · Learning Path trao đổi đã hoàn tất">
          <Badge label="5/5 sao" variant="success" />
          <Copy>Bạn chuẩn bị nội dung rõ ràng và trao đổi rất dễ hiểu.</Copy>
          <Copy muted>
            Đánh giá nhận được là dữ liệu mẫu, không thay đổi điểm uy tín tài
            khoản.
          </Copy>
        </Panel>
      ) : (
        items.map((p) => (
          <Panel key={p.id} title={p.title}>
            <Copy>{p.partner}</Copy>
            <Copy>
              {p.reviewed
                ? `Bạn đã đánh giá ${p.review?.rating}/5 sao: ${p.review?.comment}`
                : "Bạn chưa đánh giá Learning Path này."}
            </Copy>
            <RouteButton secondary href={`/paths/${p.id}/review`}>
              {p.reviewed ? "Xem đánh giá" : "Viết đánh giá"}
            </RouteButton>
          </Panel>
        ))
      )}
      {tab === "Tôi đánh giá" && !items.length && (
        <EmptyState
          title="Chưa có Learning Path để đánh giá"
          description="Hoàn thành Learning Path để chia sẻ trải nghiệm."
        />
      )}
    </FeaturePage>
  );
}
export function ReputationScreen() {
  return (
    <FeaturePage title="Điểm uy tín" back="/profile">
      <Panel title="Uy tín tài khoản mẫu" accent>
        <Metric label="Điểm uy tín" value="50 / 100" />
        <Copy>Bình thường · không hạn chế</Copy>
        <Copy muted>
          Điểm khởi tạo là 50, luôn nằm trong 0–100. Điểm thực tế và hạn chế do
          hệ thống ghi nhận.
        </Copy>
      </Panel>
      <Panel title="Cùng xây dựng sự tin cậy">
        <Copy>
          Giữ đúng lịch hẹn, hoàn thành hành trình và tôn trọng người trao đổi
          khi trao đổi.
        </Copy>
        <RouteButton secondary href="/reputation/history">
          Lịch sử điểm & vi phạm
        </RouteButton>
      </Panel>
      <RouteButton secondary href="/achievements">
        Xem danh hiệu
      </RouteButton>
    </FeaturePage>
  );
}
export function ReputationHistoryScreen() {
  return (
    <FeaturePage title="Lịch sử uy tín" back="/reputation">
      <Panel title="Khởi tạo tài khoản">
        <Copy>+50 · điểm khởi tạo trong kịch bản mẫu</Copy>
        <Copy muted>Không có sự kiện vi phạm ở tài khoản mẫu này.</Copy>
      </Panel>
      <Panel title="Khi cần xem xét vi phạm">
        <Copy>
          Chi tiết quyết định sẽ gồm lý do, thời gian, mức hạn chế và tham chiếu
          báo cáo. Bạn có thể theo dõi báo cáo hoặc liên hệ hỗ trợ.
        </Copy>
        <RouteButton secondary href="/reports">
          Báo cáo của tôi
        </RouteButton>
        <RouteButton secondary href="/help">
          Trợ giúp
        </RouteButton>
      </Panel>
    </FeaturePage>
  );
}
