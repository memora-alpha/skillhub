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
} from "../../../infrastructure/idempotency/idempotency.service";
import type {
  CheckoutDescriptor,
  CheckoutQuote,
  CheckoutRequest,
  GatewayPaymentEvent,
} from "../application/contracts/payment-gateway";
import { PaymentGateway } from "../application/ports/payment-gateway";
import type { PaymentConfiguration } from "../domain/payment-config";
import { createTopUpQuote } from "../domain/top-up-policy";

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
  checkoutUrl: z.url().refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      url.origin === "https://pay.payos.vn" &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  }),
  qrCode: z.string().min(1).max(4096),
});

/** Payment-request signatures use raw values, not payout URI encoding. */
function signatureFor(
  data: Record<string, string | number | boolean | null>,
  key: string,
): string {
  const canonical = Object.keys(data)
    .sort(byCodeUnit)
    .map((name) => {
      const value = data[name];
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
      method: "GET",
      url: data.checkoutUrl,
      paymentLinkId: data.paymentLinkId,
      qrCode: data.qrCode,
      orderCode: String(data.orderCode),
      providerStatus: data.status,
    };
  }

  verifyWebhook(body: unknown): GatewayPaymentEvent {
    const config = this.enabled();
    const envelope = this.verifyEnvelope(body);
    const parsed = webhookData.safeParse(envelope.data);
    if (!parsed.success)
      throw new BadRequestException("INVALID_PAYMENT_WEBHOOK");
    const data = parsed.data;
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
      transactionDateTime: data.transactionDateTime,
    };
    return {
      ...evidence,
      outcome:
        envelope.code === "00" &&
        envelope.success === true &&
        data.code === "00" &&
        data.currency === "VND"
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
