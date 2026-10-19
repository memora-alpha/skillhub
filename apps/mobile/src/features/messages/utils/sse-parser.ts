import { AppError } from "@/lib/http/errors";
export type SseFrame = { event: string; data: string; id?: string };
function parseField(line: string) {
  const split = line.indexOf(":");
  const field = split < 0 ? line : line.slice(0, split);
  const raw = split < 0 ? "" : line.slice(split + 1);
  return { field, value: raw.startsWith(" ") ? raw.slice(1) : raw };
}
function parseBlock(block: string): SseFrame | undefined {
  let event = "message",
    id: string | undefined;
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const { field, value } = parseField(line);
    if (field === "event") event = value;
    if (field === "id" && !value.includes("\0")) id = value;
    if (field === "data") data.push(value);
  }
  if (data.length || event.startsWith("stream."))
    return { event, id, data: data.join("\n") };
}
export function createSseParser() {
  let buffer = "";
  return {
    feed(chunk: string): SseFrame[] {
      buffer += chunk;
      if (buffer.length > 262144) throw new AppError("protocol");
      const frames: SseFrame[] = [];
      while (true) {
        const match = /\r?\n\r?\n/.exec(buffer);
        if (!match) break;
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const frame = parseBlock(block);
        if (frame) frames.push(frame);
      }
      return frames;
    },
  };
}
