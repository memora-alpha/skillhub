export type CheckoutQuote = {
  orderCode: string;
  paymentAmountVnd: bigint;
  expiresAt: Date;
};

/** Server-only REST payload. Never return this request/signature to the client. */
export type CheckoutRequest = {
  method: "POST";
  url: string;
  body: {
    orderCode: number;
    amount: number;
    description: string;
    cancelUrl: string;
    returnUrl: string;
    expiredAt: number;
    signature: string;
  };
};

/** Owner-only QR payload. Render qrCode locally; never navigate to a provider URL. */
export type CheckoutDescriptor = {
  paymentLinkId: string;
  qrCode: string;
  orderCode: string;
  providerStatus: string;
};

export type GatewayPaymentEvent = {
  gateway: "PAYOS";
  channel: string;
  orderCode: string;
  paymentLinkId: string;
  transactionId: string;
  amountVnd: string;
  currency: string;
  statusCode: string;
  transactionDateTime: string;
  outcome: "PAID" | "REVIEW";
  businessDigest: string;
  eventKey: string;
};
