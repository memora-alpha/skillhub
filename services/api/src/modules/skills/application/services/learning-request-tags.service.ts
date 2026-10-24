import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { RequestContext } from "../../../../shared/http/request-context";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { RequestTagApprover } from "../../../learning-requests/application/ports/learning-request-dependencies";
import { SkillActorService } from "../../../users/application/services/skill-actor.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { auditActorFromActor } from "../../../audit/application/contracts/audit.types";
import { TagsRepository } from "../../infrastructure/persistence/tags.repository";
import { normalizeTagLabel } from "../../domain/tag-policy";
import { tagSnapshot } from "../contracts/tag-contracts";

/** Catalog-owned write boundary for tags reviewed together with a post. */
@Injectable()
export class LearningRequestTagsService implements RequestTagApprover {
  constructor(
    private readonly repository: TagsRepository,
    private readonly actors: SkillActorService,
    private readonly audit: AuditWriter,
  ) {}

  async approveForRequest(
    tx: TransactionContext,
    principal: Principal,
    labels: readonly string[],
    requestId: string,
    context: RequestContext,
  ): Promise<string[]> {
    const actor = await this.actors.require(
      tx,
      principal,
      "learning-request:approve",
    );
    if (!actor.roles.some((role) => role === "STAFF" || role === "ADMIN")) {
      throw new ForbiddenException("REVIEWER_REQUIRED");
    }
    const selections = labels
      .map(normalizeTagLabel)
      .sort((left, right) =>
        left.labelKey < right.labelKey
          ? -1
          : Number(left.labelKey > right.labelKey),
      );
    const tagIds = new Set<string>();
    // Reserve canonical keys in one deterministic order. Each audit depends on
    // its insert result; all changes use the caller's post-review transaction.
    for (const selection of selections) {
      const { row, created } = await this.repository.createTagIfAbsent(tx, {
        ...selection,
        createdByUserId: actor.userId,
      });
      if (row.status !== "ACTIVE")
        throw new ConflictException("TAG_UNAVAILABLE");
      tagIds.add(row.id);
      if (created) {
        await this.audit.append(tx, {
          actor: auditActorFromActor(actor),
          action: "TAG_CREATE",
          target: { type: "TAG", id: row.id },
          after: tagSnapshot(row),
          reason: `Learning request ${requestId} approved`,
          context,
        });
      }
    }
    return [...tagIds];
  }
}
