import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { lockUsers } from "../../../../shared/database/identity-transactions";
import type { RequestContext } from "../../../../shared/http/request-context";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import {
  SessionsService,
  type Principal,
} from "../../../auth/application/services/sessions.service";
import {
  compileProfanityRules,
  matchCompiledProfanity,
  defaultProfanityRules,
} from "../../../content-moderation/domain/profanity-policy";
import {
  profanityConfigurationKey as key,
  profanityRuleSetSchema,
} from "../../../content-moderation/domain/profanity-rule-set";
import { ConfigurationRepository } from "../../infrastructure/persistence/configuration.repository";

const version = z.number().int().positive().max(2_147_483_646);
const reason = z.string().trim().min(1).max(500);
const updateSchema = z
  .object({ expectedVersion: version, rules: z.unknown(), reason })
  .strict();
const rollbackSchema = z
  .object({ expectedVersion: version, targetVersion: version, reason })
  .strict();
const previewSchema = z
  .object({ rules: z.unknown(), text: z.string().max(4000) })
  .strict();

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException({
      message: "INVALID_PROFANITY_RULES",
      details: result.error.issues.map(({ path, message }) => ({
        path,
        message,
      })),
    });
  return result.data;
}

@Injectable()
export class ProfanityRulesUseCase {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionsService,
    private readonly repository: ConfigurationRepository,
    private readonly audit: AuditWriter,
  ) {}

  get(actor: Principal) {
    return this.authorized(actor, (tx) => this.current(tx));
  }

  revisions(actor: Principal, before?: number) {
    return this.authorized(actor, async (tx) => {
      const rows = await tx.systemConfigurationRevision.findMany({
        where: { key, ...(before && { version: { lt: before } }) },
        orderBy: { version: "desc" },
        take: 51,
        select: {
          version: true,
          effectiveAt: true,
          actorSnapshot: true,
          auditId: true,
        },
      });
      const items = rows.slice(0, 50);
      return {
        items,
        nextCursor: rows.length > 50 ? items.at(-1)?.version : null,
      };
    });
  }

  preview(actor: Principal, body: unknown) {
    return this.authorized(actor, async (tx) => {
      const input = parse(previewSchema, body);
      const { rules } = parse(profanityRuleSetSchema, { rules: input.rules });
      const active = await this.current(tx);
      const compiled = compileProfanityRules(rules);
      const previous = compileProfanityRules(active.rules);
      const match = matchCompiledProfanity(input.text, compiled);
      const edits = new Map(rules.map((rule) => [rule.id, rule]));
      const originals = new Map(active.rules.map((rule) => [rule.id, rule]));
      return {
        version: active.version,
        outcome: match ? "BLOCK" : "ALLOW",
        match,
        changeCount: {
          added: rules.filter((rule) => !originals.has(rule.id)).length,
          updated: rules.filter(
            (rule) =>
              originals.has(rule.id) &&
              JSON.stringify(rule) !== JSON.stringify(originals.get(rule.id)),
          ).length,
          disabled: active.rules.filter(
            (rule) => rule.enabled && !edits.get(rule.id)?.enabled,
          ).length,
        },
        changedSeeds: defaultProfanityRules
          .map(({ term }) => term)
          .filter(
            (term) =>
              Boolean(matchCompiledProfanity(term, compiled)) !==
              Boolean(matchCompiledProfanity(term, previous)),
          ),
      };
    });
  }

  update(actor: Principal, body: unknown, context: RequestContext) {
    return this.authorized(actor, async (tx) => {
      const input = parse(updateSchema, body);
      return this.apply(
        tx,
        actor.userId,
        input.expectedVersion,
        parse(profanityRuleSetSchema, { rules: input.rules }),
        input.reason,
        context,
      );
    });
  }

  rollback(actor: Principal, body: unknown, context: RequestContext) {
    return this.authorized(actor, async (tx) => {
      const input = parse(rollbackSchema, body);
      const snapshot = await tx.systemConfigurationRevision.findUnique({
        where: { key_version: { key, version: input.targetVersion } },
      });
      if (!snapshot)
        throw new NotFoundException("PROFANITY_REVISION_NOT_FOUND");
      return this.apply(
        tx,
        actor.userId,
        input.expectedVersion,
        parse(profanityRuleSetSchema, snapshot.value),
        input.reason,
        context,
      );
    });
  }

  private async current(tx: TransactionContext) {
    const [row] = await this.repository.findCurrent([key], tx);
    const value = profanityRuleSetSchema.safeParse(row?.value);
    if (!row || !value.success)
      throw new ServiceUnavailableException(
        "PROFANITY_CONFIGURATION_UNAVAILABLE",
      );
    return {
      ...value.data,
      version: row.version,
      effectiveAt: row.effectiveAt,
    };
  }

  private async apply(
    tx: TransactionContext,
    userId: string,
    expectedVersion: number,
    value: z.infer<typeof profanityRuleSetSchema>,
    updateReason: string,
    context: RequestContext,
  ) {
    const current = await this.current(tx);
    if (current.version !== expectedVersion)
      throw new ConflictException("PROFANITY_VERSION_CONFLICT");
    const effectiveAt = await this.repository.databaseNow(tx);
    if (
      !(await this.repository.updateIfVersion(
        tx,
        key,
        expectedVersion,
        value,
        effectiveAt,
      ))
    ) {
      throw new ConflictException("PROFANITY_VERSION_CONFLICT");
    }
    const nextVersion = expectedVersion + 1;
    const audit = this.audit.validate({
      actor: { kind: "HUMAN", userId, roles: ["ADMIN"] },
      action: "SYSTEM_CONFIGURATION_UPDATE",
      target: { type: "SYSTEM_CONFIGURATION", id: key },
      before: { value: { rules: current.rules }, version: current.version },
      after: { value, version: nextVersion },
      reason: updateReason,
      context,
    });
    const { auditId } = await this.audit.append(tx, audit);
    await this.repository.insertRevision(tx, {
      key,
      value,
      version: nextVersion,
      effectiveAt,
      actorSnapshot: audit.actor,
      auditId,
    });
    return { ...value, version: nextVersion, effectiveAt };
  }

  private authorized<T>(
    actor: Principal,
    run: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.transactions.run(async (tx) => {
      await lockUsers(tx, [actor.userId]);
      const live = await this.sessions.assertLive(tx, actor);
      if (
        !live.roles.includes("ADMIN") ||
        !live.permissions.includes("content-moderation:configure")
      )
        throw new ForbiddenException();
      return run(tx);
    });
  }
}
