import { lazy, Suspense } from "react";
import type { PaymentQaBinding } from "@/qa/payment-qa-binding";
const Host = lazy(() =>
  import("./payment-qa-host").then((module) => ({
    default: module.PaymentFinancialQaHost,
  })),
);
// Do not load native store/create coordinator from the read-only QA entry.
export function PaymentFinancialQaHost({
  binding,
}: {
  binding: PaymentQaBinding;
}) {
  return (
    <Suspense fallback={null}>
      <Host binding={binding} />
    </Suspense>
  );
}
