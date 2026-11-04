import { useState } from "react";
import { useRouter } from "expo-router";
import { z } from "zod";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Panel, Copy } from "@/components/feature-page";
import { DataForm, textRule, creditRule } from "@/components/data-form";
import { ServerFilePicker } from "@/components/server-file-picker";
import {
  useConnections,
  useConnectionCommand,
  useConnectionList,
  useCatalogName,
  ConnectionFeedback,
  connectionError,
} from "@/features/connections";
import type { UploadedFile } from "@/lib/http/file-upload";
import type { ApiMaterial } from "../api/material-contracts";
import { useMaterialsApi } from "../hooks/use-materials";

const fileTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export function MaterialEditorForm({
  material,
}: Readonly<{ material?: ApiMaterial }>) {
  const api = useMaterialsApi(),
    runtime = useConnections(),
    router = useRouter();
  const command = useConnectionCommand<ApiMaterial>([["materials"]]);
  const [skillId, setSkillId] = useState(material?.skillId ?? ""),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const skills = useConnectionList(
    ["material-skill-options", term],
    (cursor, signal) => api.skills(term, cursor, signal),
  );
  const name = useCatalogName(skillId);
  const disabled =
    command.pending ||
    command.uncertain ||
    ["ARCHIVED", "PENDING_REVIEW", "HIDDEN"].includes(material?.status ?? "");
  return (
    <Panel title="Thông tin tài liệu">
      <Copy>
        Kỹ năng đã chọn:{" "}
        {name.data ??
          skills.items.find((skill) => skill.id === skillId)?.name ??
          "Chưa chọn"}
      </Copy>
      <Input
        label="Tìm kỹ năng"
        value={search}
        onChangeText={setSearch}
        maxLength={100}
      />
      <Button
        variant="paper"
        disabled={disabled}
        onPress={() => setTerm(search.trim())}
      >
        Tìm kỹ năng
      </Button>
      <ConnectionFeedback
        loading={skills.isLoading}
        error={skills.error}
        retry={skills.refetch}
      />
      {skills.items.map((skill) => (
        <Button
          key={skill.id}
          variant="paper"
          disabled={disabled}
          onPress={() => setSkillId(skill.id)}
        >
          {skill.name}
          {skillId === skill.id ? " · Đã chọn" : ""}
        </Button>
      ))}
      {skills.hasNextPage && (
        <Button
          disabled={skills.isFetchingNextPage}
          onPress={() => {
            void skills.fetchNextPage();
          }}
        >
          Thêm kỹ năng
        </Button>
      )}
      {material?.file && (
        <Copy>Tệp hiện tại: {material.file.originalFilename}</Copy>
      )}
      <ServerFilePicker
        files={files}
        onChange={setFiles}
        upload={api.upload}
        status={api.fileStatus}
        isCurrent={runtime.isCurrent}
        maxCount={1}
        maxBytes={20_000_000}
        types={fileTypes}
        disabled={disabled}
      />
      {!!command.error && (
        <FormNotice tone="error">{connectionError(command.error)}</FormNotice>
      )}
      {command.uncertain && (
        <Copy>
          Chưa xác định kết quả lưu. Kiểm tra danh sách tài liệu trước khi tạo
          hoặc sửa lại.
        </Copy>
      )}
      <DataForm
        defaults={{
          title: material?.title ?? "",
          description: material?.description ?? "",
          access: material?.accessType ?? "FREE",
          price: material?.priceCredit ?? "0",
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
            name: "access",
            label: "Cách chia sẻ",
            rule: z.enum(["FREE", "PAID"]),
            choices: ["FREE", "PAID"],
          },
          {
            name: "price",
            label: "Giá Credit",
            rule: creditRule(0, true),
            numeric: true,
            hint: "Miễn phí: 0. Trả phí: lớn hơn 0.",
          },
          {
            name: "rights",
            label: "Quyền phân phối",
            rule: z.literal("Tôi có quyền phân phối nội dung này"),
            choices: ["Tôi có quyền phân phối nội dung này"],
          },
        ]}
        submitLabel="Lưu tài liệu"
        disabled={
          disabled || !skillId || files.some((file) => file.state !== "READY")
        }
        onSubmit={async (values) => {
          if (!material?.file && files.length === 0)
            return "Chọn và tải lên một tệp tài liệu.";
          if ((values.access === "FREE") !== (Number(values.price) === 0))
            return "Tài liệu miễn phí có giá 0; tài liệu trả phí phải có giá lớn hơn 0.";
          const body = {
            skillId,
            title: values.title!,
            description: values.description!,
            accessType: values.access as "FREE" | "PAID",
            priceCredit: values.price!,
            distributionRightsConfirmed: true as const,
            ...(files[0] ? { fileId: files[0].fileId } : {}),
          };
          const saved = await command.run(
            JSON.stringify({
              id: material?.id,
              version: material?.listingVersion,
              body,
            }),
            () =>
              material
                ? api.update(material.id, material.listingVersion, body)
                : api.create(body),
          );
          if (saved && runtime.isCurrent()) router.replace("/materials/mine");
        }}
      />
      <Copy muted>
        Lưu trước, sau đó gửi duyệt từ danh sách tài liệu của bạn.
      </Copy>
    </Panel>
  );
}
