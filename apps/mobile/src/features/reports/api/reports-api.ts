import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { parse, resourcePath, timestamp, uuid } from "@/lib/http/contracts";
import { uploadedFileSchema } from "@/lib/http/file-upload";
import { AppError } from "@/lib/http/errors";

export const reportReasons = [
  "TECHNICAL_ISSUE",
  "INAPPROPRIATE_BEHAVIOR",
  "HARASSMENT",
  "SKILL_MISMATCH",
  "FALSE_INFORMATION",
  "CREDIT_ISSUE",
  "INAPPROPRIATE_CONTENT",
  "SPAM_SCAM",
  "OTHER",
] as const;
const status = z.enum([
  "OPEN",
  "UNDER_REVIEW",
  "NEED_MORE_INFO",
  "RESOLVED",
  "REJECTED",
]);
export const reportSchema = z.object({
  id: uuid,
  reporterId: uuid,
  targetType: z.enum(["SESSION", "MATERIAL"]),
  targetId: uuid,
  relatedSessionId: uuid.nullable(),
  relatedPathId: uuid.nullable(),
  relatedMaterialId: uuid.nullable().optional(),
  relatedOrderId: uuid.nullable().optional(),
  reasonCode: z.string(),
  description: z.string(),
  status,
  resolutionNote: z.string().nullable(),
  blocksSettlement: z.boolean(),
  createdAt: timestamp.nullable(),
  reportEvidenceCaseIdRecords: z.array(
    z.object({
      id: uuid,
      mimeType: z.string(),
      fileSizeBytes: z.string().regex(/^\d+$/),
      uploadedAt: timestamp,
    }),
  ),
});
export type UserReport = z.infer<typeof reportSchema>;
const input = z.object({
  reasonCode: z.enum(reportReasons),
  description: z.string().trim().min(10).max(2000),
  evidenceFileIds: z.array(uuid).max(5).default([]),
});
export function createReportsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  userId: string,
) {
  return {
    async detail(id: string, signal?: AbortSignal) {
      const report = parse(
        reportSchema,
        await call(resourcePath("reports/mine", id), { signal }),
      );
      if (report.id !== id || report.reporterId !== userId)
        throw new AppError("protocol");
      return report;
    },
    async mine(signal?: AbortSignal) {
      const rows = parse(
        z.array(reportSchema),
        await call("/reports/mine", { signal }),
      );
      if (
        rows.some((row) => row.reporterId !== userId) ||
        new Set(rows.map((row) => row.id)).size !== rows.length
      )
        throw new AppError("protocol");
      return rows;
    },
    async submit(
      target: "SESSION" | "MATERIAL",
      id: string,
      values: z.input<typeof input>,
    ) {
      const parsed = parse(input, values);
      if (
        new Set(parsed.evidenceFileIds).size !== parsed.evidenceFileIds.length
      )
        throw new AppError("protocol");
      const path =
        target === "SESSION"
          ? resourcePath("reports/sessions", id)
          : resourcePath("materials", id) + "/reports";
      const body =
        target === "SESSION"
          ? parsed
          : { reasonCode: parsed.reasonCode, description: parsed.description };
      return parse(
        z.object({ id: uuid, status }),
        await call(path, { method: "POST", body, replayAfterRenewal: false }),
      );
    },
    async upload(body: FormData) {
      return parse(
        uploadedFileSchema,
        await call("/reports/evidence-files", {
          method: "POST",
          body,
          multipart: true,
          replayAfterRenewal: false,
        }),
      );
    },
    async fileStatus(id: string) {
      const file = parse(
        uploadedFileSchema,
        await call(resourcePath("reports/evidence-files", id)),
      );
      if (file.fileId !== id) throw new AppError("protocol");
      return file;
    },
  };
}
