import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError, errorMessage } from "@/lib/http/errors";
import {
  parse,
  parsePage,
  pageQuery,
  resourcePath,
  timestamp,
  uuid,
  version,
} from "@/lib/http/contracts";

export const tagRequestStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;
export type TagRequestStatus = (typeof tagRequestStatuses)[number];
export const tagRequestLabels: Record<TagRequestStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};
export const tagLabelSchema = z
  .string()
  .refine(
    (label) => !/\p{Cc}/u.test(label),
    "Tag không được chứa ký tự điều khiển.",
  )
  .transform((label) => label.trim().normalize("NFC").replace(/\s+/gu, " "))
  .refine(
    (label) => [...label].length >= 1 && [...label].length <= 80,
    "Tên tag cần từ 1 đến 80 ký tự.",
  );

const schema = z.object({
  id: uuid,
  label: z.string().min(1),
  status: z.enum(tagRequestStatuses),
  requestedByUserId: uuid,
  reviewedByUserId: uuid.nullable(),
  reviewedAt: timestamp.nullable(),
  resultTagId: uuid.nullable(),
  rejectReason: z.string().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  version,
});
export type TagRequest = z.infer<typeof schema>;

export function createTagRequestsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  userId: string,
) {
  const own = (row: TagRequest) => {
    if (row.requestedByUserId !== userId) throw new AppError("protocol");
    return row;
  };
  return {
    async list(
      status?: TagRequestStatus,
      cursor?: string,
      signal?: AbortSignal,
    ) {
      const query = pageQuery(cursor);
      if (status) query.set("status", status);
      const page = parsePage(
        schema,
        await call(`/me/tag-requests?${query}`, { signal, includeMeta: true }),
      );
      page.items.forEach(own);
      if (page.items.some((row) => status && row.status !== status))
        throw new AppError("protocol");
      return page;
    },
    async detail(id: string, signal?: AbortSignal) {
      const row = own(
        parse(
          schema,
          await call(resourcePath("me/tag-requests", id), { signal }),
        ),
      );
      if (row.id !== id) throw new AppError("protocol");
      return row;
    },
    async create(label: string, key: string) {
      const body = { label: parse(tagLabelSchema, label) };
      const row = own(
        parse(
          schema,
          await call("/tag-requests", {
            method: "POST",
            body,
            idempotencyKey: key,
            replayAfterRenewal: false,
          }),
        ),
      );
      if (row.label !== body.label) throw new AppError("protocol");
      return row;
    },
  };
}

const messages: Record<string, string> = {
  TAG_ALREADY_EXISTS:
    "Tag này đã có trong danh mục. Bạn có thể tìm và chọn khi soạn bài.",
  TAG_REQUEST_PENDING:
    "Tag này đã có đề xuất đang chờ duyệt. Hãy kiểm tra danh sách hoặc đợi kết quả.",
  TAG_UNAVAILABLE:
    "Tag đã tồn tại nhưng hiện không hoạt động. Không thể đề xuất bản trùng.",
  NEW_ACTIVITY_RESTRICTED:
    "Tài khoản đang bị hạn chế tạo hoạt động mới. Bạn vẫn có thể theo dõi các đề xuất đã gửi.",
};
export function tagRequestError(error: unknown) {
  if (error instanceof AppError && Object.hasOwn(messages, error.code))
    return messages[error.code]!;
  return errorMessage(error);
}
