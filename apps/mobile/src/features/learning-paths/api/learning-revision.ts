import { z } from "zod";
import { parse, uuid, version } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";

const revisionSchema = z.object({
  id: uuid,
  version,
  status: z.string(),
  unchanged: z.boolean().default(false),
  agreementVersion: version.optional(),
});

export function readLearningRevision(
  response: unknown,
  id: string,
  expectedVersion: number,
) {
  const result = parse(revisionSchema, response);
  const nextVersion = result.unchanged ? expectedVersion : expectedVersion + 1;
  if (result.id !== id || result.version !== nextVersion)
    throw new AppError("protocol");
  return result;
}
