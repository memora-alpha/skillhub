import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { isDeepStrictEqual } from "node:util";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { LearningRequestLifecycleService } from "../../../learning-requests/application/services/learning-request-lifecycle.service";
import type { LearningRequestPathReader } from "./learning-request-path.reader";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { lockUsers } from "../../../../shared/database/identity-transactions";

/** All Path writers lock participants first, including implicit User FK locks. */
export async function lockLearningPath(
  tx: TransactionContext,
  pathId: string,
): Promise<void> {
  const path = await tx.learningPath.findUnique({
    where: { id: pathId },
    select: { participantAId: true, participantBId: true },
  });
  if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
  await lockUsers(tx, [path.participantAId, path.participantBId]);
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT path_id AS id FROM learning_paths WHERE path_id = ${pathId}::uuid FOR UPDATE`;
  if (!rows.length) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
}

/** Keep source validation and User → Request → Path locking identical for both owners. */
export async function lockLearningPathLifecycle(
  tx: TransactionContext,
  pathId: string,
  reader: LearningRequestPathReader,
  requests: LearningRequestLifecycleService,
  actor?: Principal,
) {
  const path = await tx.learningPath.findUnique({ where: { id: pathId } });
  if (!path) throw new NotFoundException("LEARNING_PATH_NOT_FOUND");
  if (
    actor &&
    actor.userId !== path.participantAId &&
    actor.userId !== path.participantBId
  )
    throw new ForbiddenException("LEARNING_PATH_ACCESS_DENIED");
  const source = await reader.readPathSource(tx, pathId);
  await lockUsers(tx, [source.participantAId, source.participantBId]);
  const request =
    source.requestId === null
      ? null
      : await requests.lockForPath(tx, source.requestId);
  await lockLearningPath(tx, pathId);
  const lockedSource = await reader.readPathSource(tx, pathId);
  if (!isDeepStrictEqual(source, lockedSource))
    throw new ConflictException("REQUEST_LIFECYCLE_INCONSISTENT");
  return request;
}
