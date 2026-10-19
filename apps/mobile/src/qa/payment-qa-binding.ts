export type PaymentQaBinding = Readonly<{
  mode: "read" | "financial";
  environment: string;
  buildId: string;
  ownerId: string;
  actions: readonly string[];
  distribution: "internal";
}>;
export function selectPaymentQa(
  value: unknown,
  current: {
    platform: string;
    environment: string;
    buildId: string;
    ownerId: string;
  },
): PaymentQaBinding | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Partial<PaymentQaBinding>;
  if (
    !["ios", "android"].includes(current.platform) ||
    b.distribution !== "internal" ||
    !["read", "financial"].includes(b.mode ?? "") ||
    !b.ownerId ||
    !b.buildId ||
    !b.environment ||
    b.ownerId !== current.ownerId ||
    b.environment !== current.environment ||
    b.buildId !== current.buildId ||
    !Array.isArray(b.actions) ||
    !b.actions.includes("read") ||
    (b.mode === "financial" &&
      !["create", "replay"].every((a) => b.actions?.includes(a)))
  )
    return null;
  return Object.freeze({
    ...b,
    actions: Object.freeze([...b.actions]),
  }) as PaymentQaBinding;
}
