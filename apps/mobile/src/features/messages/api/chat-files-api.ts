import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import { parse, resourcePath, uuid } from "@/lib/http/contracts";
import {
  chatFileStatusSchema,
  publishedAttachmentStatusSchema,
} from "./chat-attachment-contracts";

export function createChatFilesApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  const root = (id: string) => resourcePath("conversations", id);
  const published = (id: string, messageId: string, attachmentId: string) => {
    parse(uuid, messageId);
    parse(uuid, attachmentId);
    return `${root(id)}/messages/${messageId}/attachments/${attachmentId}`;
  };
  const status = (value: unknown, fileId: string) => {
    const result = parse(chatFileStatusSchema, value);
    if (result.fileId !== fileId) throw new AppError("protocol");
    return result;
  };
  return {
    async upload(
      id: string,
      body: FormData,
      signal?: AbortSignal,
      uploadKey?: string,
    ) {
      return parse(
        z.object({ fileId: uuid, state: z.literal("QUARANTINED") }),
        await call(`${root(id)}/attachments`, {
          method: "POST",
          body,
          multipart: true,
          replayAfterRenewal: false,
          ...(uploadKey ? { idempotencyKey: uploadKey } : {}),
          ...(signal ? { signal } : {}),
        }),
      );
    },
    async fileStatus(id: string, fileId: string, signal?: AbortSignal) {
      parse(uuid, fileId);
      return status(
        await call(
          `${root(id)}/attachments/${fileId}/status`,
          ...(signal ? [{ signal }] : []),
        ),
        fileId,
      );
    },
    async retryAttachment(id: string, fileId: string, signal?: AbortSignal) {
      parse(uuid, fileId);
      return status(
        await call(`${root(id)}/attachments/${fileId}/retry`, {
          method: "POST",
          replayAfterRenewal: false,
          ...(signal ? { signal } : {}),
        }),
        fileId,
      );
    },
    async publishedAttachmentStatus(
      id: string,
      messageId: string,
      attachmentId: string,
      signal?: AbortSignal,
    ) {
      return parse(
        publishedAttachmentStatusSchema,
        await call(published(id, messageId, attachmentId) + "/status", {
          signal,
        }),
      );
    },
    async content(
      id: string,
      messageId: string,
      attachmentId: string,
      variant: "content" | "preview" | "thumbnail" = "content",
      signal?: AbortSignal,
    ) {
      const result = await call(
        `${published(id, messageId, attachmentId)}/${variant}`,
        {
          responseType: "arraybuffer",
          signal,
        },
      );
      if (
        !(result instanceof Uint8Array) ||
        !result.byteLength ||
        result.byteLength > 15_000_000
      )
        throw new AppError("protocol");
      return result;
    },
  };
}
