import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { DataForm, textRule } from "@/components/data-form";
import { SampleFiles } from "@/components/sample-files";
import { skillCatalog, useSkillsPreview } from "./context";
import { previewSkillId } from "./catalog";
import { uiLabel } from "@/constants/ui-copy";
export function SkillsScreen() {
  const { skills } = useSkillsPreview();
  return (
    <FeaturePage
      title="Kỹ năng chia sẻ"
      subtitle="Những điều bạn biết có thể là điều người khác đang cần."
      back="/profile"
    >
      <RouteButton href="/skills/new">Thêm kỹ năng</RouteButton>
      {skills.map((skill) => (
        <Panel key={skill.id} title={skill.name}>
          <Badge
            label={skill.status}
            variant={skill.status === "VERIFIED" ? "success" : "warning"}
          />
          <Copy>{skill.description}</Copy>
          <Copy muted>
            {uiLabel(skill.level)} ·{" "}
            {skill.visible ? "Hiển thị công khai" : "Đã ẩn khỏi tìm kiếm"}
          </Copy>
          <RouteButton secondary href={`/skills/${skill.id}`}>
            Xem kỹ năng
          </RouteButton>
        </Panel>
      ))}
      {!skills.length && (
        <EmptyState
          title="Chưa có kỹ năng"
          description="Thêm kỹ năng đầu tiên để bắt đầu chia sẻ."
        />
      )}
      <RouteButton secondary href="/skills/history">
        Lịch sử xác minh
      </RouteButton>
    </FeaturePage>
  );
}
export function SkillEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { skills, save } = useSkillsPreview();
  const router = useRouter();
  const skill = skills.find((i) => i.id === id);
  if (id && !skill)
    return (
      <FeaturePage title="Chỉnh sửa kỹ năng" back="/skills">
        <EmptyState
          title="Không tìm thấy kỹ năng"
          description="Chọn kỹ năng của bạn trong danh sách để chỉnh sửa."
        />
      </FeaturePage>
    );
  return (
    <FeaturePage
      title={skill ? "Chỉnh sửa kỹ năng" : "Thêm kỹ năng"}
      back="/skills"
    >
      <Panel title="Chia sẻ thế mạnh của bạn">
        <DataForm
          defaults={
            skill
              ? {
                  description: skill.description,
                  level: skill.level,
                  experienceYears: skill.experienceYears ?? "",
                }
              : { level: "BEGINNER" }
          }
          fields={[
            ...(!skill
              ? [
                  {
                    name: "name",
                    label: "Danh mục kỹ năng",
                    rule: z
                      .string()
                      .refine(
                        (v) =>
                          skillCatalog.includes(
                            v as (typeof skillCatalog)[number],
                          ),
                        "Chọn kỹ năng trong danh mục.",
                      ),
                    choices: skillCatalog,
                  },
                ]
              : []),
            {
              name: "level",
              label: "Trình độ tự khai",
              rule: textRule(1, 30),
              choices: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"],
            },
            {
              name: "description",
              label: "Bạn có thể hướng dẫn điều gì?",
              rule: textRule(20, 1500),
              multiline: true,
            },
            {
              name: "experienceYears",
              label: "Số năm kinh nghiệm (không bắt buộc)",
              numeric: true,
              rule: z
                .string()
                .trim()
                .refine(
                  (v) => !v || (/^\d{1,2}(\.\d)?$/.test(v) && Number(v) <= 60),
                  "Nhập từ 0 đến 60 năm, tối đa một chữ số thập phân.",
                ),
            },
          ]}
          onSubmit={(v) => {
            if (!skill && skills.some((s) => s.name === v.name))
              return "Kỹ năng này đã có. Hãy chỉnh sửa kỹ năng hiện tại.";
            const key = skill?.id ?? `skill-${Date.now()}`;
            save({
              ...(skill ?? {
                id: key,
                skillId: previewSkillId(v.name!)!,
                name: v.name!,
                visible: true,
                status: "UNVERIFIED" as const,
              }),
              description: v.description!,
              level: v.level!,
              experienceYears: v.experienceYears || undefined,
            });
            router.replace(`/skills/${key}`);
          }}
        />
      </Panel>
    </FeaturePage>
  );
}
export function SkillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { skills, save } = useSkillsPreview();
  const skill = skills.find((s) => s.id === id);
  return (
    <FeaturePage title="Chi tiết kỹ năng" back="/skills">
      {skill ? (
        <>
          <Panel title={skill.name}>
            <Badge label={skill.status} />
            <Copy>{skill.description}</Copy>
            <Copy>
              {uiLabel(skill.level)}
              {skill.experienceYears
                ? ` · ${skill.experienceYears} năm kinh nghiệm tự khai`
                : ""}
            </Copy>
            {skill.reason && (
              <FormNotice tone="error">{skill.reason}</FormNotice>
            )}
            <Button
              variant="paper"
              onPress={() => save({ ...skill, visible: !skill.visible })}
            >
              {skill.visible ? "Ẩn khỏi tìm kiếm" : "Hiển thị công khai"}
            </Button>
          </Panel>
          <RouteButton href={`/skills/${id}/edit`}>
            Chỉnh sửa thông tin
          </RouteButton>
          <RouteButton secondary href={`/skills/${id}/evidence`}>
            {skill.status === "PENDING"
              ? "Xem hồ sơ đang chờ"
              : "Gửi bằng chứng xác minh"}
          </RouteButton>
          <Copy muted>
            Bằng chứng chỉ dành cho chủ sở hữu và người duyệt có quyền. Xác minh
            không tự hết hạn.
          </Copy>
        </>
      ) : (
        <EmptyState
          title="Không tìm thấy kỹ năng"
          description="Kỹ năng không có trong bản xem thử."
        />
      )}
    </FeaturePage>
  );
}
export function EvidenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { skills, save } = useSkillsPreview();
  const skill = skills.find((s) => s.id === id);
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState("");
  return (
    <FeaturePage title="Bằng chứng xác minh" back={`/skills/${id}`}>
      {!skill ? (
        <EmptyState
          title="Không tìm thấy kỹ năng"
          description="Không thể gửi bằng chứng."
        />
      ) : skill.status === "PENDING" || skill.pendingEvidence ? (
        <Panel title="Đang chờ xét duyệt">
          <Copy>
            Staff sẽ kiểm tra hồ sơ trước khi xác minh kỹ năng. Xác minh đã
            duyệt trước đó vẫn giữ hiệu lực nếu chưa bị thu hồi.
          </Copy>
          {(skill.pendingEvidence ?? skill.evidence)?.map((f) => (
            <Copy key={f}>{f}</Copy>
          ))}
          <RouteButton secondary href="/skills/history">
            Xem lịch sử
          </RouteButton>
        </Panel>
      ) : (
        <Panel title={skill.name}>
          {skill.reason && (
            <FormNotice tone="error">Lần gửi trước: {skill.reason}</FormNotice>
          )}
          <SampleFiles value={files} onChange={setFiles} />
          <Copy muted>
            1–5 tệp. Giới hạn kích thước thực tế cần lấy từ cấu hình bằng chứng.
          </Copy>
          {error && <FormNotice tone="error">{error}</FormNotice>}
          <DataForm
            fields={[
              {
                name: "title",
                label: "Tiêu đề bằng chứng",
                rule: textRule(0, 120),
              },
              {
                name: "description",
                label: "Mô tả",
                rule: textRule(0, 500),
                multiline: true,
              },
            ]}
            submitLabel="Gửi hồ sơ mẫu"
            onSubmit={() => {
              if (!files.length) {
                setError("Chọn ít nhất một tệp bằng chứng.");
                return;
              }
              save({
                ...skill,
                status: skill.status === "VERIFIED" ? "VERIFIED" : "PENDING",
                reason: undefined,
                pendingEvidence: files,
              });
            }}
          />
        </Panel>
      )}
    </FeaturePage>
  );
}
export function VerificationHistoryScreen() {
  const { skills } = useSkillsPreview();
  return (
    <FeaturePage title="Lịch sử xác minh" back="/skills">
      {skills
        .filter((s) => s.status !== "UNVERIFIED")
        .map((s) => (
          <Panel key={s.id} title={s.name}>
            <Badge label={s.status} />
            <Copy>{s.reason ?? "Trạng thái hồ sơ mẫu hiện tại."}</Copy>
            <RouteButton secondary href={`/skills/${s.id}/evidence`}>
              Xem hồ sơ
            </RouteButton>
          </Panel>
        ))}
    </FeaturePage>
  );
}
