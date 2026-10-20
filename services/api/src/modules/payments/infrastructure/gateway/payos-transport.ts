import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { paymentConfiguration } from "../../domain/payment-config";
import { PayosGateway } from "./payos-gateway";
import type { CheckoutQuote } from "../../application/contracts/payment-gateway";

/** Fixed-origin, bounded server transport. No redirect or provider body is logged. */
@Injectable()
export class PayosTransport {
  readonly config;
  readonly gateway;
  constructor(config: ConfigService) {
    this.config = paymentConfiguration(
      Object.fromEntries(
        [
          "PAYMENTS_ENABLED",
          "PAYMENT_CREATION_PAUSED",
          "PAYOS_CLIENT_ID",
          "PAYOS_API_KEY",
          "PAYOS_CHECKSUM_KEY",
          "PAYOS_RETURN_URL",
          "PAYOS_CANCEL_URL",
        ].map((key) => [key, config.get(key)]),
      ),
    );
    this.gateway = new PayosGateway(this.config);
  }

  private async request(path: string, body?: unknown): Promise<unknown> {
    if (!this.config.enabled)
      throw new ServiceUnavailableException("PAYMENT_PROVIDER_UNAVAILABLE");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(
        `https://api-merchant.payos.vn/v2/payment-requests${path}`,
        {
          method: body === undefined ? "GET" : "POST",
          redirect: "error",
          signal: controller.signal,
          headers: {
            "x-client-id": this.config.PAYOS_CLIENT_ID,
            "x-api-key": this.config.PAYOS_API_KEY,
            "content-type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
      if (!response.ok || !response.body)
        throw new Error("Provider unavailable");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > 131072) throw new Error("Provider response too large");
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    } catch {
      throw new ServiceUnavailableException("PAYMENT_PROVIDER_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  }

  async create(
    quote: CheckoutQuote,
    urls: { returnUrl: string; cancelUrl: string },
  ) {
    if (!this.config.enabled)
      throw new ServiceUnavailableException("PAYMENT_PROVIDER_UNAVAILABLE");
    const gateway = new PayosGateway({
      ...this.config,
      PAYOS_RETURN_URL: urls.returnUrl,
      PAYOS_CANCEL_URL: urls.cancelUrl,
    });
    const request = gateway.prepareCheckout(quote);
    const response = await this.request("", request.body);
    if (
      !response ||
      typeof response !== "object" ||
      !("code" in response) ||
      response.code !== "00"
    )
      throw new ServiceUnavailableException("PAYMENT_PROVIDER_UNAVAILABLE");
    return gateway.verifyCheckoutResponse(response, quote);
  }
  async lookup(quote: CheckoutQuote) {
    const response = await this.request(
      `/${encodeURIComponent(quote.orderCode)}`,
    );
    if (
      !response ||
      typeof response !== "object" ||
      !("code" in response) ||
      response.code !== "00"
    )
      throw new ServiceUnavailableException("PAYMENT_PROVIDER_UNAVAILABLE");
    return this.gateway.verifyLookupResponse(response, quote);
  }

  async cancel(
    quote: CheckoutQuote,
    cancellationReason = "User requested cancellation",
  ) {
    const response = await this.request(
      `/${encodeURIComponent(quote.orderCode)}/cancel`,
      { cancellationReason },
    );
    if (
      !response ||
      typeof response !== "object" ||
      !("code" in response) ||
      response.code !== "00"
    )
      throw new ServiceUnavailableException("PAYMENT_PROVIDER_UNAVAILABLE");
    // Cancellation and lookup return the same signed payment-link evidence.
    return this.gateway.verifyLookupResponse(response, quote);
  }
}
