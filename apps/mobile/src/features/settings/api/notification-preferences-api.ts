import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { parse } from "@/lib/http/contracts";

const preferencesSchema = z.object({
  learning: z.boolean(),
  credit: z.boolean(),
  community: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof preferencesSchema>;

export function createNotificationPreferencesApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
) {
  return {
    async read(signal?: AbortSignal) {
      return parse(
        preferencesSchema,
        await call("/me/notification-preferences", { signal }),
      );
    },
    async update(patch: Partial<NotificationPreferences>) {
      return parse(
        preferencesSchema,
        await call("/me/notification-preferences", {
          method: "PATCH",
          body: patch,
        }),
      );
    },
  };
}
