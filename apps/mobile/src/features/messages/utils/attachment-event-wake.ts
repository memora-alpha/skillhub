import { z } from "zod";
import { uuid } from "@/lib/http/contracts";
import type { SseFrame } from "./sse-parser";

const reference = z.object({
  version: z.literal(1),
  data: z.object({ fileId: uuid }),
});

// Events shorten the wait; the worker still confirms status/delivery with HTTP.
export function attachmentEventWake(
  frame: SseFrame,
): { fileId?: string } | undefined {
  if (frame.event === "stream.ready") return {};
  if (
    frame.event !== "chat.attachment.updated" &&
    frame.event !== "chat.attachment.availability.updated"
  )
    return;
  try {
    const result = reference.safeParse(JSON.parse(frame.data));
    return result.success ? { fileId: result.data.data.fileId } : undefined;
  } catch {
    return;
  }
}
