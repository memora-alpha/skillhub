import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import {
  parsePage,
  pageQuery,
  resourcePath,
  timestamp,
  uuid,
} from "@/lib/http/contracts";

export const notificationSchema = z.object({
  id: uuid,
  type: z.string(),
  title: z.string(),
  body: z.string(),
  payload: z.unknown(),
  readAt: timestamp.nullable(),
  createdAt: timestamp,
});
export type InboxNotification = z.infer<typeof notificationSchema>;

export function createNotificationsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  return {
    async list(cursor?: string, signal?: AbortSignal) {
      return parsePage(
        notificationSchema,
        await call(`/notifications?${pageQuery(cursor)}`, {
          includeMeta: true,
          signal,
        }),
      );
    },
    async markRead(id: string) {
      await call(`${resourcePath("notifications", id)}/read`, {
        method: "PATCH",
      });
    },
  };
}
