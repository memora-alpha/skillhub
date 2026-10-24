import { z } from "zod";

export const MAX_REQUEST_TAGS = 10;

export const normalizeTagLabel = (label: string) =>
  label.trim().normalize("NFC").replace(/\s+/gu, " ");

export const proposedTagSchema = z
  .string()
  .refine(
    (label) => !/\p{Cc}/u.test(label),
    "Tag không được chứa ký tự điều khiển.",
  )
  .transform(normalizeTagLabel)
  .refine(
    (label) => [...label].length >= 1 && [...label].length <= 80,
    "Tên tag cần từ 1 đến 80 ký tự.",
  );

export const proposedTagsSchema = z
  .array(proposedTagSchema)
  .max(MAX_REQUEST_TAGS, "Chỉ được chọn và đề xuất tối đa 10 tag.")
  .refine(
    (labels) =>
      new Set(labels.map((label) => label.toLowerCase())).size ===
      labels.length,
    "Tag đề xuất bị trùng tên.",
  );
