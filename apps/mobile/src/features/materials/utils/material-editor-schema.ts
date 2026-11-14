import { z } from "zod";
import { credit, type MaterialInput } from "../api/material-contracts";
import type { UploadedFile } from "@/lib/http/file-upload";

export const materialEditorSchema = z
  .object({
    skillId: z.uuid("Chọn một kỹ năng liên quan."),
    title: z
      .string()
      .trim()
      .refine(
        (value) => [...value].length >= 5 && [...value].length <= 150,
        "Nhập tên tài liệu từ 5 đến 150 ký tự.",
      ),
    description: z
      .string()
      .trim()
      .refine(
        (value) => [...value].length >= 10 && [...value].length <= 3000,
        "Thêm mô tả từ 10 đến 3.000 ký tự để người học hiểu nội dung.",
      ),
    accessType: z.enum(["FREE", "PAID"]),
    priceCredit: z
      .string()
      .trim()
      .refine(
        (value) => credit.safeParse(value).success,
        "Nhập giá bằng số, tối đa 10 chữ số và 2 chữ số thập phân.",
      ),
    rights: z
      .boolean()
      .refine(
        (value) => value,
        "Xác nhận bạn có quyền phân phối nội dung này.",
      ),
  })
  .superRefine((value, ctx) => {
    if (
      value.accessType === "FREE"
        ? Number(value.priceCredit) !== 0
        : Number(value.priceCredit) <= 0
    )
      ctx.addIssue({
        code: "custom",
        path: ["priceCredit"],
        message:
          value.accessType === "FREE"
            ? "Tài liệu miễn phí có giá 0 Credit."
            : "Nhập giá lớn hơn 0 Credit.",
      });
  });
export type MaterialEditorValues = z.infer<typeof materialEditorSchema>;
export function editorMaterialInput(
  values: MaterialEditorValues,
  file?: UploadedFile,
): MaterialInput {
  const checked = materialEditorSchema.parse(values);
  if (file && file.state !== "READY")
    throw new Error("Tệp chưa hoàn tất kiểm tra an toàn.");
  return {
    skillId: checked.skillId,
    title: checked.title,
    description: checked.description,
    accessType: checked.accessType,
    priceCredit: checked.priceCredit,
    distributionRightsConfirmed: true,
    ...(file ? { fileId: file.fileId } : {}),
  };
}
