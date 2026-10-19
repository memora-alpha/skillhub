import { Injectable, NotFoundException } from "@nestjs/common";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import type { Principal } from "../../auth/application/services/sessions.service";
import { SkillActorService } from "../../users/application/services/skill-actor.service";
@Injectable()
export class ConversationAccessService {
  constructor(private readonly actors: SkillActorService) {}
  async require(
    tx: TransactionContext,
    principal: Principal,
    id: string,
    permission = "conversation:read:participant",
    lock = false,
  ) {
    const snapshot = await tx.conversation.findUnique({ where: { id } });
    if (
      !snapshot ||
      ![snapshot.participantAId, snapshot.participantBId].includes(
        principal.userId,
      )
    )
      throw new NotFoundException();
    const actor = await this.actors.require(tx, principal, permission, [
      snapshot.participantAId,
      snapshot.participantBId,
    ]);
    if (lock)
      await tx.$queryRaw`SELECT conversation_id FROM conversations WHERE conversation_id=${id}::uuid FOR UPDATE`;
    return { conversation: snapshot, actor };
  }
}
