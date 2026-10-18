import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type {
  Prisma,
  CreditOperation,
  CreditTransaction,
  CreditLot,
  IdempotencyRecord,
} from "../../../../generated/prisma/client";
import { PayosTransport } from "../../infrastructure/payos-transport";
import type { PaymentConfiguration } from "../../domain/payment-config";

const selector = z
  .object({
    userId: z.uuid().optional(),
    paymentId: z.uuid().optional(),
    orderCode: z
      .string()
      .refine(
        (v) =>
          /^[1-9]\d{0,15}$/.test(v) &&
          BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER),
      )
      .optional(),
    transactionId: z.string().min(1).max(255).optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine(
    (v) =>
      [v.userId, v.paymentId, v.orderCode, v.transactionId].filter(Boolean)
        .length === 1,
  );
type Query = z.infer<typeof selector>;
type Payment = Prisma.PaymentGetPayload<{ include: { payosCheckout: true } }>;
type Operation = Pick<CreditOperation, "id" | "referenceId">;
type Mapping = Pick<
  IdempotencyRecord,
  "scope" | "keyDigest" | "resultReference" | "fingerprint" | "completedAt"
>;
type Evidence = {
  operations: Operation[];
  mappings: Mapping[];
  entries: Pick<CreditTransaction, "operationId" | "amount">[];
  lots: Pick<CreditLot, "operationId" | "granted">[];
};
function paymentWhere(
  query: Query,
  receiptPaymentIds: string[],
): Prisma.PaymentWhereInput {
  if (query.userId) return { userId: query.userId };
  if (query.paymentId) return { id: query.paymentId };
  if (query.orderCode) return { externalOrderRef: query.orderCode };
  return {
    OR: [
      { gatewayTransactionId: query.transactionId },
      { id: { in: receiptPaymentIds } },
    ],
  };
}
function creationFindings(payment: Payment, mappings: Mapping[]) {
  const findings: string[] = [];
  if (!payment.payosCheckout) findings.push("PAYMENT_CHECKOUT_MISSING");
  if (payment.status === "REVIEW") findings.push("PAYMENT_REVIEW_REQUIRED");
  if (!payment.creationKeyDigest)
    findings.push("PAYMENT_CREATION_IDENTITY_MISSING");
  else if (
    !mappings.some(
      (m) =>
        m.scope === payment.userId &&
        m.keyDigest === payment.creationKeyDigest &&
        m.completedAt !== null &&
        m.fingerprint === payment.creationFingerprint &&
        (m.resultReference as { id?: string } | null)?.id === payment.id,
    )
  )
    findings.push("PAYMENT_HTTP_MAPPING_MISSING_OR_MISMATCHED");
  return findings;
}
function postingFindings(
  payment: Payment,
  tops: Operation[],
  evidence: Evidence,
) {
  const findings: string[] = [],
    ids = new Set(tops.map((o) => o.id));
  if (
    payment.status === "PAID" &&
    (tops.length !== 1 ||
      payment.payosCheckout?.topUpOperationId !== tops[0]?.id)
  )
    findings.push("PAYMENT_TOP_UP_LINK_MISMATCH");
  if (payment.status !== "PAID" && tops.length)
    findings.push("TOP_UP_WITHOUT_PAID_PAYMENT");
  if (!tops.length) return findings;
  const entries = evidence.entries.filter((e) => ids.has(e.operationId));
  const lots = evidence.lots.filter((l) => ids.has(l.operationId));
  if (
    entries.length !== 1 ||
    entries[0]?.amount !== payment.creditAmount ||
    lots.length !== 1 ||
    lots[0]?.granted !== payment.creditAmount
  )
    findings.push("PAYMENT_LEDGER_OR_LOT_MISMATCH");
  return findings;
}
function recordView(
  payment: Payment,
  evidence: Evidence,
  config: PaymentConfiguration,
) {
  const checkout = payment.payosCheckout,
    tops = evidence.operations.filter((o) => o.referenceId === payment.id);
  return {
    paymentId: payment.id,
    userId: payment.userId,
    status: payment.status,
    paymentAmountVnd: payment.paymentAmountVnd.toString(),
    orderCode: checkout?.orderCode.toString() ?? payment.externalOrderRef,
    paymentLinkId: checkout?.paymentLinkId ?? null,
    currentChannelMatches:
      !!checkout &&
      config.enabled &&
      checkout.channel === config.PAYOS_CLIENT_ID,
    topUpOperationIds: tops.map((o) => o.id),
    findings: [
      ...creationFindings(payment, evidence.mappings),
      ...postingFindings(payment, tops, evidence),
    ],
    lookupQuote: checkout
      ? {
          orderCode: checkout.orderCode.toString(),
          paymentAmountVnd: payment.paymentAmountVnd,
          expiresAt: checkout.expiresAt,
        }
      : null,
  };
}
type RecordView = ReturnType<typeof recordView>;
type ProviderView = {
  state: string;
  status?: string;
  exact?: boolean;
  transactionCount?: number;
};

/** Operator-only read report. No HTTP route, repair, status transition or wallet write. */
export class PaymentReconciliationReader {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly transport: PayosTransport,
  ) {}

  async report(input: unknown, lookupProvider = false) {
    const parsed = selector.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException("INVALID_PAYMENT_RECONCILIATION_SELECTOR");
    const snapshot = await this.snapshot(parsed.data),
      records = [];
    // Bound provider calls, outside the read-only DB snapshot; never burst against the merchant.
    for (const record of snapshot.records) {
      const { lookupQuote, ...publicRecord } = record;
      const provider = await this.providerView(
        publicRecord,
        lookupQuote,
        lookupProvider,
      );
      records.push({ ...publicRecord, provider });
    }
    return {
      snapshotAt: snapshot.snapshotAt,
      readOnly: true,
      records,
      receipts: snapshot.receipts,
      truncated: snapshot.truncated,
      missingPayment: records.length === 0,
      limitation:
        "No automatic restore, receipt reassignment, repair or authorization to create a replacement. Missing DB identity requires merchant-side reconciliation.",
    };
  }

  private snapshot(query: Query) {
    return this.transactions.run(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const snapshotAt = new Date().toISOString(),
        bound = query.limit + 1;
      const byReference = query.transactionId
        ? await tx.paymentReceipt.findMany({
            where: { transactionId: query.transactionId },
            take: bound,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          })
        : [];
      const payments = await tx.payment.findMany({
        where: paymentWhere(
          query,
          byReference.flatMap((r) => (r.paymentId ? [r.paymentId] : [])),
        ),
        include: { payosCheckout: true },
        take: bound,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      const visible = payments.slice(0, query.limit),
        ids = visible.map((p) => p.id);
      const receiptWhere: Prisma.PaymentReceiptWhereInput = {
        OR: [
          { paymentId: { in: ids } },
          ...(query.orderCode
            ? [{ evidence: { path: ["orderCode"], equals: query.orderCode } }]
            : []),
        ],
      };
      const [receipts, operations, mappings] = await Promise.all([
        query.transactionId
          ? Promise.resolve(byReference)
          : tx.paymentReceipt.findMany({
              where: receiptWhere,
              take: bound,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            }),
        tx.creditOperation.findMany({
          where: {
            referenceType: "PAYMENT",
            referenceId: { in: ids },
            operationType: "TOP_UP",
            status: "SUCCESS",
          },
          select: { id: true, referenceId: true },
          take: bound,
        }),
        tx.idempotencyRecord.findMany({
          where: {
            operation: "payment:create",
            OR: visible
              .filter((p) => p.creationKeyDigest)
              .map((p) => ({
                scope: p.userId,
                keyDigest: p.creationKeyDigest!,
              })),
          },
          select: {
            scope: true,
            keyDigest: true,
            resultReference: true,
            fingerprint: true,
            completedAt: true,
          },
        }),
      ]);
      const operationIds = operations.map((o) => o.id);
      const [entries, lots] = await Promise.all([
        tx.creditTransaction.findMany({
          where: { operationId: { in: operationIds }, type: "TOP_UP" },
          select: { operationId: true, amount: true },
          take: bound,
        }),
        tx.creditLot.findMany({
          where: { operationId: { in: operationIds } },
          select: { operationId: true, granted: true },
          take: bound,
        }),
      ]);
      return {
        snapshotAt,
        records: visible.map((p) =>
          recordView(
            p,
            { operations, mappings, entries, lots },
            this.transport.config,
          ),
        ),
        receipts: receipts.slice(0, query.limit).map((r) => ({
          id: r.id,
          paymentId: r.paymentId,
          transactionId: r.transactionId,
          state: r.state,
          reason: r.reason,
          conflict: r.conflict,
          createdAt: r.createdAt,
        })),
        truncated: [payments, receipts, operations, entries, lots].some(
          (rows) => rows.length > query.limit,
        ),
      };
    });
  }

  private async providerView(
    record: Omit<RecordView, "lookupQuote">,
    lookupQuote: RecordView["lookupQuote"],
    requested: boolean,
  ): Promise<ProviderView> {
    if (!requested) return { state: "NOT_REQUESTED" };
    if (!record.currentChannelMatches || !lookupQuote)
      return { state: "UNAVAILABLE_FOR_STORED_CHANNEL_OR_QUOTE" };
    try {
      const lookup = await this.transport.lookup(lookupQuote);
      if (record.paymentLinkId && lookup.paymentLinkId !== record.paymentLinkId)
        record.findings.push("PAYMENT_PROVIDER_LINK_MISMATCH");
      if (lookup.status === "PAID" && record.status !== "PAID")
        record.findings.push("PROVIDER_PAID_NOT_POSTED");
      return {
        state: "VERIFIED",
        status: lookup.status,
        exact: lookup.exact,
        transactionCount: lookup.events.length,
      };
    } catch {
      return { state: "LOOKUP_UNAVAILABLE_OR_INVALID" };
    }
  }
}
