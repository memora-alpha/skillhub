import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { TransactionRunner } from "../database/transaction-runner";
import type {
  IdempotencyInput,
  JsonValue,
  ResultReference,
} from "./idempotency.types";

/** UTF-16 code unit order, same as the default sort: locale-independent, so a fingerprint is identical on every host. */
export function byCodeUnit(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

function normalizeJson(value: JsonValue): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new BadRequestException("Invalid command");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (typeof value !== "object")
    throw new BadRequestException("Invalid command");
  const result: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort(byCodeUnit)) {
    const item = value[key];
    if (item === undefined) throw new BadRequestException("Invalid command");
    result[key] = normalizeJson(item);
  }
  return result;
}

export function canonicalJson(value: JsonValue): string {
  try {
    return JSON.stringify(normalizeJson(value));
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("Invalid command");
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function fingerprintCommand(command: JsonValue): string {
  return sha256(canonicalJson(command));
}

function validateReference(value: ResultReference): void {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.status !== "string" ||
    !value.status ||
    (value.version !== undefined &&
      (!Number.isInteger(value.version) || value.version < 0)) ||
    Object.keys(value).some((key) => !["id", "status", "version"].includes(key))
  ) {
    throw new BadRequestException("Result must be a minimal reference");
  }
}

function assertFingerprint(
  stored: string,
  expected: string,
  conflictMessage?: string,
) {
  if (stored !== expected)
    throw new ConflictException(
      conflictMessage ?? "Idempotency key belongs to a different command",
    );
}

function completedReference<T>(record: {
  completedAt: Date | null;
  resultReference: Prisma.JsonValue;
}): T {
  if (!record.completedAt || !record.resultReference)
    throw new ServiceUnavailableException("Idempotency record incomplete");
  return record.resultReference as T;
}

/** Not valid canonical JSON, so no command fingerprint can equal it. */
const RETIRED_FINGERPRINT = sha256("idempotency:retired");

@Injectable()
export class IdempotencyService {
  constructor(private readonly transactions: TransactionRunner) {}

  /**
   * Settle a key for a status lookup inside the caller's transaction. Waits for an in-flight
   * command holding the key to commit or roll back. A key with no committed command is retired:
   * a late request with that key is rejected as reused instead of executing.
   * Returns true when a command had committed under the key.
   */
  async retire(
    tx: Prisma.TransactionClient,
    input: Pick<IdempotencyInput, "scope" | "operation" | "key">,
  ): Promise<boolean> {
    const keyDigest = sha256(input.key);
    const inserted = await tx.$executeRaw`
      INSERT INTO "idempotency_records" ("scope", "operation", "key_digest", "fingerprint")
      VALUES (${input.scope}, ${input.operation}, ${keyDigest}, ${RETIRED_FINGERPRINT})
      ON CONFLICT ("scope", "operation", "key_digest") DO NOTHING
    `;
    if (inserted) return false;
    const record = await tx.idempotencyRecord.findUnique({
      where: {
        scope_operation_keyDigest: {
          scope: input.scope,
          operation: input.operation,
          keyDigest,
        },
      },
    });
    if (!record)
      throw new ServiceUnavailableException("Idempotency record unavailable");
    return record.fingerprint !== RETIRED_FINGERPRINT;
  }

  async execute<T extends ResultReference, Prepared = never>(
    input: IdempotencyInput,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    authorize?: (tx: Prisma.TransactionClient) => Promise<void>,
    preflight?: {
      prepare: (tx: Prisma.TransactionClient) => Promise<Prepared>;
      check: (prepared: Prepared) => Promise<void>;
    },
  ): Promise<{ value: T; replayed: boolean }> {
    if (
      !/^[\x21-\x7e]{1,128}$/.test(input.key) ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(input.scope) ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(input.operation)
    )
      throw new BadRequestException("Invalid idempotency identity");
    const keyDigest = sha256(input.key);
    const fingerprint = fingerprintCommand(input.command);
    const where = {
      scope_operation_keyDigest: {
        scope: input.scope,
        operation: input.operation,
        keyDigest,
      },
    };
    if (preflight) {
      const check = await this.transactions.run(async (tx) => {
        await authorize?.(tx);
        const record = await tx.idempotencyRecord.findUnique({ where });
        if (!record)
          return {
            replayed: false as const,
            prepared: await preflight.prepare(tx),
          };
        assertFingerprint(
          record.fingerprint,
          fingerprint,
          input.conflictMessage,
        );
        return {
          replayed: true as const,
          value: completedReference<T>(record),
        };
      });
      if (check.replayed) return check;
      // The external check runs without locks. The write below authorizes and validates again.
      await preflight.check(check.prepared);
    }
    return this.transactions.run(async (tx) => {
      // Authorization runs for fresh commands and completed replays in the same transaction.
      await authorize?.(tx);
      const inserted = await tx.$executeRaw`
        INSERT INTO "idempotency_records" ("scope", "operation", "key_digest", "fingerprint")
        VALUES (${input.scope}, ${input.operation}, ${keyDigest}, ${fingerprint})
        ON CONFLICT ("scope", "operation", "key_digest") DO NOTHING
      `;
      const record = await tx.idempotencyRecord.findUnique({ where });
      if (!record)
        throw new ServiceUnavailableException("Idempotency record unavailable");
      assertFingerprint(record.fingerprint, fingerprint, input.conflictMessage);
      if (inserted === 0)
        return { value: completedReference<T>(record), replayed: true };
      const value = await work(tx);
      validateReference(value);
      await tx.idempotencyRecord.update({
        where,
        data: {
          resultReference: value as Prisma.InputJsonObject,
          completedAt: new Date(),
        },
      });
      return { value, replayed: false };
    });
  }
}
