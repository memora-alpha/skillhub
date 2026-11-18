import { GatewayError } from "../gateway/upstream";

type QueueRow = Record<string, unknown> & {
  id: string;
  source: "SYSTEM" | "USER";
};
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function sourceOf(value: unknown): "SYSTEM" | "USER" | undefined {
  if (!value || typeof value !== "object") return undefined;
  if ("reporterId" in value) {
    if (value.reporterId === null) return "SYSTEM";
    if (typeof value.reporterId === "string" && uuid.test(value.reporterId))
      return "USER";
  }
  if (
    "source" in value &&
    (value.source === "SYSTEM" || value.source === "USER")
  )
    return value.source;
  return undefined;
}

/** Old queues omitted origin; resolve only missing fields, with at most four reads in flight. */
export async function reportQueueOrigins(
  input: unknown,
  readDetail: (id: string) => Promise<unknown>,
): Promise<QueueRow[]> {
  if (!Array.isArray(input) || input.length > 100)
    throw new GatewayError(502, "API_RESPONSE_INVALID");
  const result: QueueRow[] = [];
  for (let start = 0; start < input.length; start += 4) {
    const chunk = await Promise.all(
      input.slice(start, start + 4).map(async (row: unknown) => {
        if (
          !row ||
          typeof row !== "object" ||
          !("id" in row) ||
          typeof row.id !== "string" ||
          !uuid.test(row.id)
        )
          throw new GatewayError(502, "API_RESPONSE_INVALID");
        let source = sourceOf(row);
        if (!source) source = sourceOf(await readDetail(row.id));
        if (!source) throw new GatewayError(502, "API_RESPONSE_INVALID");
        return { ...row, id: row.id, source } as QueueRow;
      }),
    );
    result.push(...chunk);
  }
  return result;
}
