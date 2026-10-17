import type { WalletView } from "../utils/navigation";

const views: readonly string[] = [
  "wallet",
  "topup",
  "payment",
  "status",
  "history",
  "transaction",
];
const states: readonly string[] = [
  "CREATED",
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
];
const legacy: Record<string, string> = {
  pending: "PENDING",
  success: "PAID",
  failed: "FAILED",
  expired: "EXPIRED",
};
export function previewSelection(params: {
  view?: unknown;
  state?: unknown;
  id?: unknown;
}) {
  const view =
    typeof params.view === "string" && views.includes(params.view)
      ? (params.view as WalletView)
      : "wallet";
  const raw = typeof params.state === "string" ? params.state : "PENDING";
  const state = states.includes(raw) ? raw : (legacy[raw] ?? "UNKNOWN");
  const id =
    typeof params.id === "string" && /^preview-tx-[a-z-]+$/.test(params.id)
      ? params.id
      : undefined;
  return { view, state, id };
}
export function previewHref(view: WalletView, state?: string, id?: string) {
  const query = new URLSearchParams({ view });
  if (state) query.set("state", state);
  if (id) query.set("id", id);
  return `/ui/wallet-preview?${query.toString()}` as const;
}
