import { createPreviewPaymentHost } from "./payment-contract-host";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { Copy, Panel } from "../components/wallet-ui";
import { projectPaymentRead } from "../utils/payment-read-query";
import { paymentStatusPresentation } from "../utils/payment-status-presentation";
import { PaymentStatusPanel } from "../components/payment-status-panel";
import { createOwnerPaymentRefresh } from "../utils/payment-related-reads";
import type { PaymentRefresh } from "../utils/payment-refresh";

const states = [
  "CREATED",
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REVIEW",
  "FUTURE_STATE",
];
export function LivePaymentStatusPreview() {
  const [selection, setSelection] = useState({ state: "PENDING", serial: 0 });
  return (
    <>
      <Panel title="Hợp đồng Payment · mẫu độc lập">
        <Copy>
          Chỉ đọc dữ liệu tổng hợp trong bộ nhớ riêng; không gọi API tài chính
          và không ghi cache tài khoản.
        </Copy>
        {states.map((state) => (
          <Button
            key={state}
            variant="paper"
            onPress={() =>
              setSelection((old) => ({ state, serial: old.serial + 1 }))
            }
          >{`Hợp đồng mẫu ${state}`}</Button>
        ))}
      </Panel>
      <LiveCase key={selection.serial} status={selection.state} />
    </>
  );
}
function LiveCase({ status }: { status: string }) {
  const [host] = useState(() => createPreviewPaymentHost(status));
  const subscribe = useCallback(
    (callback: () => void) => host.observer.subscribe(callback),
    [host],
  );
  const query = useSyncExternalStore(
    subscribe,
    () => host.observer.getCurrentResult(),
    () => host.observer.getCurrentResult(),
  );
  const state = projectPaymentRead(host.runtime, host.id, query);
  const [refresh, setRefresh] = useState<PaymentRefresh>();
  useEffect(() => {
    host.runtime.activate();
    void host.observer.refetch({ cancelRefetch: false });
    return host.cleanup;
  }, [host]);
  useEffect(() => {
    if (state.data?.status !== "PAID") return;
    const next = createOwnerPaymentRefresh(
      host.runtime,
      host.queries,
      host.client,
      state.data,
    );
    setRefresh(next);
    void next.refresh();
    return next.dispose;
  }, [host, state.data]);
  const related = useSyncExternalStore(
    refresh?.subscribe ?? (() => () => {}),
    refresh?.getSnapshot ?? (() => empty),
    () => empty,
  );
  const run = (mode: string) => {
    host.setMode(mode);
    void host.observer.refetch({ cancelRefetch: false });
  };
  return (
    <View testID="payment-contract-preview" style={{ gap: 16 }}>
      <PaymentStatusPanel
        state={paymentStatusPresentation(state)}
        onCheck={() => {
          void host.observer.refetch({ cancelRefetch: false });
        }}
        refresh={related}
        onRefresh={(name) => {
          void refresh?.refresh(name);
        }}
      />
      <Panel title="Thử đọc hợp đồng mẫu">
        {[
          ["hide", "Ẩn QR cùng version"],
          ["restore", "Response QR cũ"],
          ["paid", "PAID version mới"],
          ["conflict", "Mâu thuẫn cùng version"],
          ["denied", "Owner bị từ chối mẫu"],
          ["error", "Lỗi đọc hợp đồng mẫu"],
          ["ok", "Đọc hợp đồng đúng"],
        ].map(([mode, label]) => (
          <Button key={mode} variant="paper" onPress={() => run(mode!)}>
            {label}
          </Button>
        ))}
        <Button
          variant="paper"
          onPress={() => {
            host.setMode("wallet-error");
            void refresh?.refresh("wallet");
          }}
        >
          Lỗi refresh Wallet hợp đồng
        </Button>
        <Button
          variant="paper"
          onPress={() => {
            host.setMode("history-error");
            void refresh?.refresh("history");
          }}
        >
          Lỗi refresh History hợp đồng
        </Button>
        <Copy>{`Đọc model hợp đồng: ${host.count}; QR ${state.data?.checkout ? "có dữ liệu mẫu" : "đã ẩn/chưa có"}; không render mã thanh toán.`}</Copy>
      </Panel>
    </View>
  );
}
const empty = {
  wallet: { status: "unavailable" as const, stale: false },
  history: { status: "unavailable" as const, stale: false },
};
