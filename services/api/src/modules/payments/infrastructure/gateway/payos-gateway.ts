import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  byCodeUnit,
  fingerprintCommand,
} from "../../../../infrastructure/idempotency/idempotency.service";
import type {
  CheckoutDescriptor,
  CheckoutQuote,
  CheckoutRequest,
  GatewayPaymentEvent,
} from "../../application/contracts/payment-gateway";
import { PaymentGateway } from "../../application/ports/payment-gateway";
import type { PaymentConfiguration } from "../../domain/payment-config";
import { createTopUpQuote } from "../../domain/top-up-policy";
import { paymentTime } from "../../domain/payment-time";

const identifier = z.string().min(1).max(255);
const positiveInteger = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
// Payment-link create responses and payment webhooks contain flat data. Reject
// unsupported shapes rather than silently dropping fields before verification.
const signedEnvelope = z.object({
  code: z.string(),
  success: z.boolean().optional(),
  data: z.record(
    z.string(),
    z.union([z.string(), z.number().safe(), z.boolean(), z.null()]),
  ),
  signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
});
const webhookData = z.object({
  orderCode: positiveInteger,
  amount: positiveInteger,
  paymentLinkId: identifier,
  reference: identifier,
  currency: identifier,
  code: identifier,
  transactionDateTime: identifier,
});
const checkoutData = z.object({
  orderCode: positiveInteger,
  amount: positiveInteger,
  paymentLinkId: identifier,
  currency: z.literal("VND"),
  status: z.enum(["PENDING", "PROCESSING", "PAID", "CANCELLED", "EXPIRED"]),
  qrCode: z.string().min(1).max(4096),
});
const scalar = z.union([z.string(), z.number().safe(), z.boolean(), z.null()]);
const lookupEnvelope = signedEnvelope.extend({
  data: z.record(
    z.string(),
    z.union([scalar, z.array(z.record(z.string(), scalar))]),
  ),
});
const lookupData = z.object({
  id: identifier,
  orderCode: positiveInteger,
  amount: positiveInteger,
  amountPaid: z.number().int().nonnegative().safe(),
  amountRemaining: z.number().int().nonnegative().safe(),
  status: checkoutData.shape.status,
  transactions: z
    .array(
      z.object({
        reference: identifier,
        amount: positiveInteger,
        transactionDateTime: identifier,
      }),
    )
    .max(100),
});

/** Payment-request signatures use raw values, not payout URI encoding. */
function signatureFor(
  data: Record<
    string,
    | string
    | number
    | boolean
    | null
    | Record<string, string | number | boolean | null>[]
  >,
  key: string,
): string {
  const canonical = Object.keys(data)
    .sort(byCodeUnit)
    .map((name) => {
      const value = data[name];
      if (Array.isArray(value)) {
        const sorted = value.map((item) =>
          Object.fromEntries(
            Object.keys(item)
              .sort(byCodeUnit)
              .map((key) => [key, item[key]]),
          ),
        );
        return `${name}=${JSON.stringify(sorted)}`;
      }
      const text =
        value === null || value === "null" || value === "undefined"
          ? ""
          : String(value);
      return `${name}=${text}`;
    })
    .join("&");
  return createHmac("sha256", key).update(canonical).digest("hex");
}

/** Pure protocol adapter; transport, durable intents and posting remain in orchestration. */
export class PayosGateway extends PaymentGateway {
  constructor(private readonly config: PaymentConfiguration) {
    super();
  }

  private enabled() {
    if (!this.config.enabled)
      throw new ServiceUnavailableException("PAYMENT_PROVIDER_UNAVAILABLE");
    return this.config;
  }

  prepareCheckout(quote: CheckoutQuote, now = new Date()): CheckoutRequest {
    const config = this.enabled();
    if (
      !/^[1-9]\d{0,15}$/.test(quote.orderCode) ||
      !Number.isSafeInteger(Number(quote.orderCode))
    )
      throw new BadRequestException("INVALID_PAYMENT_REFERENCE");
    const policyQuote = createTopUpQuote(quote.paymentAmountVnd, now);
    const expiredAt = Math.floor(quote.expiresAt.getTime() / 1000);
    if (
      !Number.isInteger(expiredAt) ||
      expiredAt > 2147483647 ||
      expiredAt <= Math.floor(now.getTime() / 1000) ||
      quote.expiresAt > policyQuote.expiresAt
    )
      throw new BadRequestException("INVALID_PAYMENT_EXPIRY");
    const signed = {
      amount: Number(quote.paymentAmountVnd), // Approved bounds are safely below JS integer limits.
      cancelUrl: config.PAYOS_CANCEL_URL,
      description: "SH CREDIT", // Nine characters, compatible with linked-bank limits.
      orderCode: Number(quote.orderCode),
      returnUrl: config.PAYOS_RETURN_URL,
    };
    return {
      method: "POST",
      url: "https://api-merchant.payos.vn/v2/payment-requests",
      body: {
        ...signed,
        expiredAt,
        signature: signatureFor(signed, config.PAYOS_CHECKSUM_KEY),
      },
    };
  }

  private verifyEnvelope(body: unknown) {
    const config = this.enabled();
    const parsed = signedEnvelope.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException("INVALID_PAYMENT_PROVIDER_PAYLOAD");
    const expected = signatureFor(parsed.data.data, config.PAYOS_CHECKSUM_KEY);
    if (
      !timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(parsed.data.signature, "hex"),
      )
    )
      throw new UnauthorizedException("PAYMENT_SIGNATURE_INVALID");
    return parsed.data;
  }

  verifyCheckoutResponse(
    body: unknown,
    quote: CheckoutQuote,
  ): CheckoutDescriptor {
    const envelope = this.verifyEnvelope(body);
    const parsed = checkoutData.safeParse(envelope.data);
    if (
      envelope.code !== "00" ||
      !parsed.success ||
      String(parsed.data.orderCode) !== quote.orderCode ||
      BigInt(parsed.data.amount) !== quote.paymentAmountVnd
    )
      throw new BadRequestException("PAYMENT_CHECKOUT_MISMATCH");
    const data = parsed.data;
    return {
      paymentLinkId: data.paymentLinkId,
      qrCode: data.qrCode,
      orderCode: String(data.orderCode),
      providerStatus: data.status,
    };
  }

  verifyWebhook(body: unknown): GatewayPaymentEvent {
    const envelope = this.verifyEnvelope(body);
    const parsed = webhookData.safeParse(envelope.data);
    if (!parsed.success)
      throw new BadRequestException("INVALID_PAYMENT_WEBHOOK");
    const data = parsed.data;
    return this.event(
      data,
      envelope.code === "00" && envelope.success === true,
    );
  }

  verifyLookupResponse(body: unknown, quote: CheckoutQuote) {
    const config = this.enabled();
    const envelope = lookupEnvelope.safeParse(body);
    if (!envelope.success)
      throw new BadRequestException("INVALID_PAYMENT_LOOKUP");
    const expected = signatureFor(
      envelope.data.data,
      config.PAYOS_CHECKSUM_KEY,
    );
    if (
      !timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(envelope.data.signature, "hex"),
      )
    )
      throw new UnauthorizedException("PAYMENT_SIGNATURE_INVALID");
    const parsed = lookupData.safeParse(envelope.data.data);
    if (!parsed.success)
      throw new BadRequestException("INVALID_PAYMENT_LOOKUP");
    const data = parsed.data;
    if (
      envelope.data.code !== "00" ||
      String(data.orderCode) !== quote.orderCode ||
      BigInt(data.amount) !== quote.paymentAmountVnd
    )
      throw new BadRequestException("PAYMENT_LOOKUP_MISMATCH");
    return {
      paymentLinkId: data.id,
      status: data.status,
      hasPayment:
        data.amountPaid !== 0 ||
        data.amountRemaining !== data.amount ||
        data.transactions.length > 0,
      exact:
        data.amountPaid === data.amount &&
        data.amountRemaining === 0 &&
        data.transactions.length === 1 &&
        data.transactions[0]!.amount === data.amount,
      events: data.transactions.map((transaction) =>
        this.event(
          {
            ...transaction,
            orderCode: data.orderCode,
            paymentLinkId: data.id,
            currency: "VND",
            code: "00",
          },
          data.status === "PAID",
        ),
      ),
    };
  }

  private event(
    data: z.infer<typeof webhookData>,
    success: boolean,
  ): GatewayPaymentEvent {
    const config = this.enabled();
    // Only whitelisted business evidence leaves the adapter, after authenticating
    // every signed field (including account details that must not be persisted).
    const evidence = {
      gateway: "PAYOS" as const,
      channel: config.PAYOS_CLIENT_ID,
      orderCode: String(data.orderCode),
      paymentLinkId: data.paymentLinkId,
      transactionId: data.reference,
      amountVnd: String(data.amount),
      currency: data.currency,
      statusCode: data.code,
      transactionDateTime:
        paymentTime(data.transactionDateTime)?.toISOString() ??
        data.transactionDateTime,
    };
    return {
      ...evidence,
      outcome:
        success && data.code === "00" && data.currency === "VND"
          ? "PAID"
          : "REVIEW",
      businessDigest: fingerprintCommand(evidence),
      eventKey: fingerprintCommand({
        gateway: evidence.gateway,
        channel: evidence.channel,
        transactionId: evidence.transactionId,
      }),
    };
  }
}
