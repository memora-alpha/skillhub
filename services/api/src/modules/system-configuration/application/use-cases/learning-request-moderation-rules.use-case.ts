import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "../../../../generated/prisma/client";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import type { RequestContext } from "../../../../shared/http/request-context";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { SessionsService } from "../../../auth/application/services/sessions.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import type { AuditActor } from "../../../audit/application/contracts/audit.types";
import type { RoleCode } from "../../../../shared/authorization/authorization.types";
import {
  moderationRuleSetSchema,
  type ModerationRuleSet,
} from "../../domain/moderation-rule-set.schema";
import { ConfigurationRepository } from "../../infrastructure/persistence/configuration.repository";
import { SystemConfigurationService } from "../services/system-configuration.service";

const configurationKey = "learningRequest.moderationRuleSet" as const;
const configurationPermission = "learning-request:moderation:configure";
const roleCodes = new Set<RoleCode>(["USER", "STAFF", "ADMIN"]);

export type LearningRequestModerationRuleSnapshot = {
  rules: ModerationRuleSet["rules"];
  version: number;
  readAt: Date;
};

function requireAdmin(principal: Principal): void {
  if (!principal.roles.includes("ADMIN")) throw new ForbiddenException();
  if (!principal.permissions.includes(configurationPermission)) {
    throw new ForbiddenException();
  }
}

function auditActor(principal: Principal): AuditActor {
  const roles = principal.roles.filter((role): role is RoleCode =>
    roleCodes.has(role as RoleCode),
  );
  if (!roles.includes("ADMIN")) throw new ForbiddenException();
  return { kind: "HUMAN", userId: principal.userId, roles };
}

@Injectable()
export class LearningRequestModerationRulesUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionsService,
    private readonly repository: ConfigurationRepository,
    private readonly audit: AuditWriter,
    private readonly reader: SystemConfigurationService,
  ) {}

  async get(actor: Principal): Promise<LearningRequestModerationRuleSnapshot> {
    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.sessions.assertLive(tx, actor);
      requireAdmin(live);
      const snapshot = await this.reader.getSnapshot([configurationKey], tx);
      return {
        rules: snapshot.values[configurationKey].rules,
        version: snapshot.versions[configurationKey],
        readAt: snapshot.readAt,
      };
    });
  }

  async update(
    actor: Principal,
    input: {
      expectedVersion: number;
      rules: unknown;
      reason: string;
      context: RequestContext;
    },
  ): Promise<LearningRequestModerationRuleSnapshot> {
    if (
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1
    ) {
      throw new BadRequestException("INVALID_CONFIGURATION_PATCH");
    }
    let value: ModerationRuleSet;
    try {
      value = moderationRuleSetSchema.parse({ rules: input.rules });
    } catch {
      throw new BadRequestException("INVALID_MODERATION_RULES");
    }
    if (value.rules.length === 0) {
      throw new BadRequestException("MODERATION_RULES_REQUIRED");
    }

    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.sessions.assertLive(tx, actor);
      requireAdmin(live);
      const current = (
        await this.repository.findCurrent([configurationKey], tx)
      )[0];
      if (current?.version !== input.expectedVersion) {
        throw new ConflictException("Configuration version conflict");
      }
      const effectiveAt = await this.repository.databaseNow(tx);
      const inputValue = value as Prisma.InputJsonValue;
      const before = this.audit.validate({
        actor: auditActor(live),
        action: "SYSTEM_CONFIGURATION_UPDATE",
        target: { type: "SYSTEM_CONFIGURATION", id: configurationKey },
        before: { value: current.value, version: current.version },
        after: { value: inputValue, version: current.version + 1 },
        reason: input.reason,
        context: input.context,
      });
      const written = await this.repository.updateIfVersion(
        tx,
        configurationKey,
        input.expectedVersion,
        inputValue,
        effectiveAt,
      );
      if (!written)
        throw new ConflictException("Configuration version conflict");
      const { auditId } = await this.audit.append(tx, before);
      await this.repository.insertRevision(tx, {
        key: configurationKey,
        value: inputValue,
        version: input.expectedVersion + 1,
        effectiveAt,
        actorSnapshot: before.actor as Prisma.InputJsonValue,
        auditId,
      });
      const snapshot = await this.reader.getSnapshot([configurationKey], tx);
      return {
        rules: snapshot.values[configurationKey].rules,
        version: snapshot.versions[configurationKey],
        readAt: snapshot.readAt,
      };
    });
  }
}
