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
function byCodeUnit(left: string, right: string): number {
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

@Injectable()
export class IdempotencyService {
  constructor(private readonly transactions: TransactionRunner) {}

  async execute<T extends ResultReference>(
    input: IdempotencyInput,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<{ value: T; replayed: boolean }> {
    if (
      !/^[\x21-\x7e]{1,128}$/.test(input.key) ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(input.scope) ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(input.operation)
    )
      throw new BadRequestException("Invalid idempotency identity");
    const keyDigest = sha256(input.key);
    const fingerprint = fingerprintCommand(input.command);
    return this.transactions.run(async (tx) => {
      const inserted = await tx.$executeRaw`
        INSERT INTO "idempotency_records" ("scope", "operation", "key_digest", "fingerprint")
        VALUES (${input.scope}, ${input.operation}, ${keyDigest}, ${fingerprint})
        ON CONFLICT ("scope", "operation", "key_digest") DO NOTHING
      `;
      const where = {
        scope_operation_keyDigest: {
          scope: input.scope,
          operation: input.operation,
          keyDigest,
        },
      };
      const record = await tx.idempotencyRecord.findUnique({ where });
      if (!record)
        throw new ServiceUnavailableException("Idempotency record unavailable");
      if (record.fingerprint !== fingerprint) {
        throw new ConflictException(
          "Idempotency key belongs to a different command",
        );
      }
      if (inserted === 0) {
        if (!record.completedAt || !record.resultReference) {
          throw new ServiceUnavailableException(
            "Idempotency record incomplete",
          );
        }
        return { value: record.resultReference as T, replayed: true };
      }
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
