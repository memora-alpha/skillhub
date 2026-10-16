import type {
  CheckoutDescriptor,
  CheckoutQuote,
  CheckoutRequest,
  GatewayPaymentEvent,
} from "../contracts/payment-gateway";

export abstract class PaymentGateway {
  abstract prepareCheckout(quote: CheckoutQuote, now?: Date): CheckoutRequest;
  abstract verifyCheckoutResponse(
    body: unknown,
    quote: CheckoutQuote,
  ): CheckoutDescriptor;
  abstract verifyWebhook(body: unknown): GatewayPaymentEvent;
}
