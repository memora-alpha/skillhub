import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ChoiceGroup } from "@/components/choice-group";
import { FormNotice } from "@/components/FormNotice";
import { EmptyState } from "@/components/EmptyState";
import { DataForm, textRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { useRequestsPreview } from "./context";
import { skillCatalog, previewSkillId } from "@/features/skills";
import { uiLabel } from "@/constants/ui-copy";
import { parsePreferredSlots, formatPreferredSlots } from "./preferred-slots";
const editable = ["DRAFT", "OPEN", "PENDING_MODERATION", "REJECTED"];
export function MyRequestsScreen() {
  const { requests } = useRequestsPreview();
  const [filter, setFilter] = useState("Tất cả");
  const items = requests.filter(
    (r) => filter === "Tất cả" || r.status === filter,
  );
  return (
    <FeaturePage
      title="Yêu cầu học của tôi"
      back="/discover"
      subtitle="Quản lý nhu cầu học, bài nháp và phản hồi kiểm duyệt."
    >
      <RouteButton href="/requests/new">Đăng yêu cầu học</RouteButton>
      <ChoiceGroup
        label="Trạng thái"
        options={[
          "Tất cả",
          "DRAFT",
          "PENDING_MODERATION",
          "OPEN",
          "REJECTED",
          "MATCHED",
          "CANCELLED",
        ]}
        value={filter}
        onChange={setFilter}
      />
      {items.map((r) => (
        <Panel key={r.id} title={r.title}>
          <Badge label={r.status} />
          <Copy>{r.goal}</Copy>
          <RouteButton secondary href={`/requests/${r.id}`}>
            Xem yêu cầu
          </RouteButton>
        </Panel>
      ))}
      {!items.length && (
        <EmptyState
          title="Chưa có yêu cầu ở trạng thái này"
          description="Thử bộ lọc khác hoặc tạo yêu cầu mới."
        />
      )}
    </FeaturePage>
  );
}
export function RequestEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { requests, save } = useRequestsPreview();
  const request = requests.find((r) => r.id === id);
  const router = useRouter();
  return (
    <FeaturePage
      title={id ? "Sửa yêu cầu học" : "Tạo yêu cầu học"}
      back="/requests"
    >
      {id && (!request || !editable.includes(request.status)) ? (
        <EmptyState
          title="Không thể chỉnh sửa"
          description="Yêu cầu không còn ở trạng thái cho phép sửa."
        />
      ) : (
        <Panel title="Bạn muốn học điều gì?">
          <DataForm
            defaults={
              request
                ? {
                    title: request.title,
                    skill: request.skill,
                    description: request.description,
                    goal: request.goal,
                    level: request.level,
                    tags: (request.tags ?? []).join(", "),
                    preferredSlots: formatPreferredSlots(
                      request.preferredSlots,
                    ),
                  }
                : { level: "BEGINNER" }
            }
            fields={[
              { name: "title", label: "Tiêu đề", rule: textRule(10, 120) },
              {
                name: "skill",
                label: "Kỹ năng muốn học",
                rule: z.string().min(1, "Chọn một kỹ năng."),
                choices: [
                  "React",
                  "TypeScript",
                  "JavaScript",
                  "UI/UX",
                  "Tiếng Anh",
                  "Guitar",
                  "Nhiếp ảnh",
                ],
              },
              {
                name: "description",
                label: "Mô tả nhu cầu",
                rule: textRule(20, 3000),
                multiline: true,
              },
              {
                name: "goal",
                label: "Mục tiêu học tập",
                rule: textRule(10, 1000),
                multiline: true,
              },
              {
                name: "level",
                label: "Trình độ hiện tại",
                rule: textRule(1, 30),
                choices: ["NONE", "BEGINNER", "INTERMEDIATE", "ADVANCED"],
              },
              {
                name: "tags",
                label: "Tag bổ sung (không bắt buộc)",
                hint: "Phân cách bằng dấu phẩy. Dùng tên kỹ năng trong danh mục phía trên.",
                rule: z
                  .string()
                  .trim()
                  .refine(
                    (v) =>
                      !v ||
                      (v.split(",").length <= 10 &&
                        v
                          .split(",")
                          .every((tag) =>
                            skillCatalog.some(
                              (name) =>
                                name.toLowerCase() === tag.trim().toLowerCase(),
                            ),
                          )),
                    "Tối đa 10 tag trong danh mục kỹ năng.",
                  ),
              },
              {
                name: "preferredSlots",
                label: "Khoảng thời gian ưu tiên (không bắt buộc)",
                multiline: true,
                hint: "Mỗi dòng: 2026-12-01 19:00 → 2026-12-01 21:00. Tối đa 5 khoảng theo giờ thiết bị; chưa chốt lịch.",
                rule: z
                  .string()
                  .refine(
                    (v) => parsePreferredSlots(v) !== undefined,
                    "Nhập tối đa 5 khoảng tương lai, giờ kết thúc sau giờ bắt đầu, đúng mẫu hướng dẫn.",
                  ),
              },
            ]}
            submitLabel="Lưu bản nháp mẫu"
            onSubmit={(v) => {
              const key = request?.id ?? `request-${Date.now()}`;
              save({
                id: key,
                title: v.title!,
                skill: v.skill!,
                skillId: previewSkillId(v.skill!)!,
                tags: v
                  .tags!.split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                preferredSlots: parsePreferredSlots(v.preferredSlots!),
                description: v.description!,
                goal: v.goal!,
                level: v.level!,
                status: "DRAFT",
              });
              router.replace(`/requests/${key}`);
            }}
          />
          <Copy muted>
            Đăng bài ở bước tiếp theo. Mọi lần đăng hoặc sửa bài đều cần kiểm
            tra kiểm duyệt lại.
          </Copy>
        </Panel>
      )}
    </FeaturePage>
  );
}
export function OwnRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { requests, save } = useRequestsPreview();
  const request = requests.find((r) => r.id === id);
  const [cancel, setCancel] = useState(false);
  return (
    <FeaturePage title="Chi tiết yêu cầu của tôi" back="/requests">
      {!request ? (
        <EmptyState
          title="Không tìm thấy yêu cầu"
          description="Yêu cầu không có trong bản xem thử."
        />
      ) : (
        <>
          <Panel title={request.title}>
            <Badge label={request.status} />
            <Copy>
              {request.skill} · {uiLabel(request.level)}
            </Copy>
            <Copy>{request.description}</Copy>
            <Copy>Mục tiêu: {request.goal}</Copy>
            {!!request.tags?.length && (
              <Copy>Tag: {request.tags.join(", ")}</Copy>
            )}
            {request.preferredSlots?.map((slot) => (
              <Copy key={slot.startAt}>
                Ưu tiên: {new Date(slot.startAt).toLocaleString("vi-VN")} →{" "}
                {new Date(slot.endAt).toLocaleString("vi-VN")} (chưa chốt lịch)
              </Copy>
            ))}
            {request.reason && (
              <FormNotice tone="error">
                Lý do từ chối mẫu: {request.reason}
              </FormNotice>
            )}
            {request.status === "PENDING_MODERATION" && (
              <FormNotice tone="info">
                Bài đang chờ duyệt và chưa nhận đề xuất mới.
              </FormNotice>
            )}
            {request.status === "MATCHED" && (
              <FormNotice tone="info">
                Lịch đã khóa. Hãy sử dụng đổi lịch hoặc báo cáo trong lộ trình.
              </FormNotice>
            )}
          </Panel>
          {editable.includes(request.status) && (
            <RouteButton secondary href={`/requests/${id}/edit`}>
              Chỉnh sửa yêu cầu
            </RouteButton>
          )}
          {request.status === "DRAFT" && (
            <Button
              variant="craft"
              onPress={() => save({ ...request, status: "PENDING_MODERATION" })}
            >
              Đăng vào hàng chờ mẫu
            </Button>
          )}
          {request.status === "OPEN" && (
            <RouteButton href="/proposals">Xem đề xuất nhận được</RouteButton>
          )}
          {!["MATCHED", "CANCELLED", "EXPIRED"].includes(request.status) && (
            <Button variant="paper" onPress={() => setCancel(true)}>
              Hủy yêu cầu
            </Button>
          )}
          {cancel && (
            <Panel title="Hủy yêu cầu này?">
              <Copy>
                Lịch sử đề xuất được giữ lại. Bài sẽ không nhận đề xuất mới.
              </Copy>
              <Button
                onPress={() => {
                  save({ ...request, status: "CANCELLED" });
                  setCancel(false);
                }}
              >
                Xác nhận hủy bản mẫu
              </Button>
              <Button variant="paper" onPress={() => setCancel(false)}>
                Giữ yêu cầu
              </Button>
            </Panel>
          )}
        </>
      )}
    </FeaturePage>
  );
}
