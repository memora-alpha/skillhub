import { parsePayment } from "../schemas/payment-contracts";
import {
  createPaymentObservation,
  reducePaymentObservation,
  type PaymentLiveObservation,
} from "../utils/payment-observation";
import {
  paymentQrFromObservation,
  type QrPresentation,
} from "../utils/payment-qr-model";

// Independent synthetic data, never a payOS/VietQR payload or account client/cache.
export const previewQrPayloads = {
  ascii: "SYNTHETIC ONLY",
  unicode: "  synthetic raw\nĐồng e\u0301 € 😀\r\n ",
  dense: "synthetic-dense:" + "x".repeat(420),
  markup: '<svg onload="synthetic-only">& https://example.invalid/qr</svg>',
  overCapacity: "x".repeat(4096),
  invalid: "synthetic-\ud800",
} as const;
type Snapshot = Readonly<{
  model: QrPresentation;
  owner: string;
  status: string;
  version: number;
}>;

export function createQrPreviewHost() {
  let active = true,
    owner = "A",
    generation = 1,
    version = 1,
    raw: string = previewQrPayloads.ascii;
  let observation: PaymentLiveObservation | undefined,
    closed = false,
    failed = false,
    denied = false;
  let retired:
    | { scope: { ownerId: string; generation: number }; paymentId: string }
    | undefined;
  const listeners = new Set<() => void>();
  const scope = () => ({ ownerId: "synthetic-qr-" + owner, generation });
  const id = () =>
    owner === "A"
      ? "10000000-0000-4000-8000-000000000001"
      : "10000000-0000-4000-8000-000000000002";
  const snapshot = (): Snapshot => {
    const model = paymentQrFromObservation(
      observation,
      scope(),
      active && !denied,
    );
    const display: QrPresentation = closed
      ? { stage: "unavailable", paymentId: model.paymentId }
      : failed && model.raw
        ? { ...model, stage: "render-error" }
        : model;
    return Object.freeze({
      owner,
      status: observation?.data?.status ?? "Chưa đọc mẫu",
      version,
      model: display,
    });
  };
  let state = snapshot();
  const publish = () => {
    state = snapshot();
    for (const notify of listeners) notify();
  };
  function accept(hidden = false, status = "PENDING") {
    if (!active || denied) return;
    observation ??= createPaymentObservation({
      scope: scope(),
      paymentId: id(),
    });
    observation = reducePaymentObservation(observation, {
      scope: scope(),
      paymentId: id(),
      ticket: 1,
      currentTicket: 1,
      data: parsePayment({
        id: id(),
        gateway: "PAYOS",
        status,
        paymentAmountVnd: "123000",
        currency: "VND",
        creditAmount: "123.00",
        conversionRateVndPerCredit: 1000,
        createdAt: "2026-10-17T00:00:00Z",
        expiresAt: null,
        paidAt: null,
        version,
        recoveryRequired: false,
        recoveryReason: null,
        checkout:
          hidden || status !== "PENDING"
            ? null
            : {
                paymentLinkId: "synthetic-only",
                orderCode: "123",
                providerStatus: "PENDING",
                qrCode: raw,
              },
      }),
    });
    publish();
  }
  return {
    getSnapshot: () => state,
    subscribe: (notify: () => void) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    load: (name: keyof typeof previewQrPayloads) => {
      if (!active || denied) return;
      raw = previewQrPayloads[name];
      version++;
      closed = false;
      failed = false;
      accept();
    },
    hide: () => accept(true),
    restore: () => accept(),
    newer: () => {
      version++;
      accept();
    },
    paid: () => {
      version++;
      accept(true, "PAID");
    },
    fail: () => {
      failed = true;
      publish();
    },
    retry: () => {
      failed = false;
      publish();
    },
    close: () => {
      closed = true;
      publish();
    },
    reopen: () => {
      closed = false;
      publish();
    },
    deny: () => {
      denied = true;
      observation = undefined;
      raw = "";
      publish();
    },
    switchOwner: () => {
      retired = { scope: scope(), paymentId: id() };
      owner = owner === "A" ? "B" : "A";
      generation++;
      observation = undefined;
      denied = false;
      closed = false;
      failed = false;
      raw = "";
      version = 1;
      publish();
    },
    late: () => {
      if (!active || !retired || denied) return;
      observation ??= createPaymentObservation({
        scope: scope(),
        paymentId: id(),
      });
      observation = reducePaymentObservation(observation, {
        ...retired,
        ticket: 1,
        currentTicket: 1,
        data: parsePayment({
          id: retired.paymentId,
          gateway: "PAYOS",
          status: "PENDING",
          paymentAmountVnd: "123000",
          currency: "VND",
          creditAmount: "123.00",
          conversionRateVndPerCredit: 1000,
          createdAt: "2026-10-17T00:00:00Z",
          expiresAt: null,
          paidAt: null,
          version: 100,
          recoveryRequired: false,
          recoveryReason: null,
          checkout: {
            paymentLinkId: "synthetic-old",
            orderCode: "123",
            providerStatus: "PENDING",
            qrCode: previewQrPayloads.ascii,
          },
        }),
      });
      publish();
    },
    activate: () => {
      active = true;
      publish();
    },
    dispose: () => {
      active = false;
      observation = undefined;
      raw = "";
      closed = true;
      publish();
    },
  };
}
