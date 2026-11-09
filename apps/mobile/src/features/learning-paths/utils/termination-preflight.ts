import { AppError } from "@/lib/http/errors";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import type { TerminationRequest } from "../api/path-changes-contract";
import {
  canRequestTermination,
  terminationSessionsCompleted,
} from "./termination-policy";

export async function preflightTerminationRequest(options: {
  pathId: string;
  userId?: string;
  isCurrent: () => boolean;
  readPath: () => Promise<ApiLearningPath>;
  readRequests: () => Promise<TerminationRequest[]>;
}) {
  if (!options.isCurrent() || !options.userId) throw new AppError("session");
  const [path, requests] = await Promise.all([
    options.readPath(),
    options.readRequests(),
  ]);
  if (!options.isCurrent()) throw new AppError("session");
  if (
    path.id !== options.pathId ||
    ![path.participantAId, path.participantBId].includes(options.userId) ||
    requests.some((row) => row.pathId !== options.pathId)
  )
    throw new AppError("protocol");
  if (terminationSessionsCompleted(path))
    throw new AppError("http", 409, "TERMINATION_USE_FINAL_SETTLEMENT");
  if (!canRequestTermination(path, requests))
    throw new AppError(
      "http",
      409,
      requests.some((row) =>
        ["PENDING", "ACCEPTED", "STAFF_REVIEW"].includes(row.status),
      )
        ? "CHANGE_REQUEST_ALREADY_PENDING"
        : "LEARNING_PATH_CANNOT_BE_CHANGED",
    );
}
