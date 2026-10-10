import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { SampleFiles } from "@/components/sample-files";
import { DataForm, textRule, creditRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { useMaterialsPreview } from "../context";
export function MyMaterialsScreen() {
  const { materials, save } = useMaterialsPreview();
  const [archive, setArchive] = useState<string>();
  return (
    <FeaturePage title="Tài liệu tôi chia sẻ" back="/profile">
      <RouteButton href="/materials/new">Đăng tài liệu</RouteButton>
      {materials
        .filter((m) => m.owner === "me")
        .map((m) => (
          <Panel key={m.id} title={m.title}>
            <Badge label={m.status} />
            <Copy>{m.reason ?? m.description}</Copy>
            <RouteButton secondary href={`/materials/${m.id}`}>
              Xem & chỉnh sửa
            </RouteButton>
            {m.status !== "ARCHIVED" && (
              <Button variant="paper" onPress={() => setArchive(m.id)}>
                Ngừng phân phối
              </Button>
            )}
            {archive === m.id && (
              <>
                <Copy>
                  Ngừng phân phối bản mẫu? Lịch sử phiên bản vẫn được giữ.
                </Copy>
                <Button
                  onPress={() => {
                    save({ ...m, status: "ARCHIVED" });
                    setArchive(undefined);
                  }}
                >
                  Xác nhận ngừng
                </Button>
                <Button variant="paper" onPress={() => setArchive(undefined)}>
                  Giữ tài liệu
                </Button>
              </>
            )}
          </Panel>
        ))}
      <RouteButton secondary href="/materials/library">
        Tài liệu đã nhận / đã mua
      </RouteButton>
    </FeaturePage>
  );
}
export function MaterialEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { materials, save } = useMaterialsPreview();
  const m = materials.find((i) => i.id === id);
  const router = useRouter();
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState("");
  return (
    <FeaturePage
      title={id ? "Sửa tài liệu / phiên bản mới" : "Đăng tài liệu"}
      back="/materials/mine"
    >
      {id && (!m || m.owner !== "me" || m.status === "ARCHIVED") ? (
        <EmptyState
          title="Không thể chỉnh sửa"
          description="Bạn chỉ chỉnh sửa tài liệu của mình còn được quản lý."
        />
      ) : (
        <Panel title="Chia sẻ tài liệu hữu ích">
          <SampleFiles value={files} onChange={setFiles} maxCount={1} />
          {m && (
            <Copy>
              Tệp hiện tại: {m.file}. Chọn tệp mới sẽ tạo phiên bản mới.
            </Copy>
          )}
          {error && <FormNotice tone="error">{error}</FormNotice>}
          <DataForm
            defaults={{
              title: m?.title ?? "",
              description: m?.description ?? "",
              skill: m?.skill ?? "React",
              access: m?.access ?? "FREE",
              price: m?.price ?? "0",
            }}
            fields={[
              { name: "title", label: "Tên tài liệu", rule: textRule(5, 150) },
              {
                name: "description",
                label: "Mô tả",
                rule: textRule(10, 3000),
                multiline: true,
              },
              {
                name: "skill",
                label: "Danh mục kỹ năng",
                rule: textRule(1, 100),
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
                name: "access",
                label: "Cách chia sẻ",
                rule: z.string().min(1),
                choices: ["FREE", "PAID"],
              },
              {
                name: "price",
                label: "Giá (Credit)",
                rule: creditRule(0, true),
                numeric: true,
                hint: "FREE = 0; PAID > 0. Tối đa 2 số thập phân.",
              },
              {
                name: "rights",
                label: "Quyền phân phối",
                rule: z.string().min(1, "Xác nhận quyền phân phối."),
                choices: ["Tôi có quyền phân phối nội dung này"],
              },
            ]}
            submitLabel="Gửi tài liệu mẫu để duyệt"
            onSubmit={(v) => {
              if (!m && !files.length) {
                setError("Chọn một tệp tài liệu mẫu.");
                return;
              }
              if (v.access === "FREE" && Number(v.price) !== 0)
                return "Tài liệu FREE phải có giá 0.";
              if (v.access === "PAID" && Number(v.price) <= 0)
                return "Tài liệu PAID phải có giá lớn hơn 0.";
              const key = id ?? `material-${Date.now()}`;
              save({
                id: key,
                owner: "me",
                title: v.title!,
                description: v.description!,
                skill: v.skill!,
                access: v.access as "FREE" | "PAID",
                price: v.price!,
                version: (m?.version ?? 0) + 1,
                status: "PENDING_REVIEW",
                file: files[0] ?? m!.file,
              });
              router.replace(`/materials/${key}`);
            }}
          />
          <Copy muted>
            Tệp cần kiểm tra định dạng, kích thước theo cấu hình riêng và quét
            an toàn trước khi công bố. Không dùng giới hạn 15 MB của chat.
          </Copy>
        </Panel>
      )}
    </FeaturePage>
  );
}
