import { AppError } from "@/lib/http/errors";
export type SseFrame = { event: string; data: string; id?: string };
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
        let event = "message",
          id: string | undefined;
        const data: string[] = [];
        for (const line of block.split(/\r?\n/)) {
          if (!line || line.startsWith(":")) continue;
          const split = line.indexOf(":");
          const field = split < 0 ? line : line.slice(0, split);
          let value = split < 0 ? "" : line.slice(split + 1);
          if (value.startsWith(" ")) value = value.slice(1);
          if (field === "event") event = value;
          if (field === "id" && !value.includes("\0")) id = value;
          if (field === "data") data.push(value);
        }
        if (data.length || event.startsWith("stream."))
          frames.push({ event, id, data: data.join("\n") });
      }
      return frames;
    },
  };
}
