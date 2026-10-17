import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button } from "@/components/Button";
import { PaymentStatusPanel } from "../components/payment-status-panel";
import { createPaymentRefresh } from "../utils/payment-refresh";
import type { PaymentObservationModel } from "../types/payment";

export function PaidRefresh({
  payment,
  state,
  onCheck,
  qrError,
}: {
  payment: PaymentObservationModel;
  state: Parameters<typeof PaymentStatusPanel>[0]["state"];
  onCheck: () => void;
  qrError: boolean;
}) {
  const alive = useRef(true),
    failures = useRef({ wallet: false, history: false });
  const [refresh] = useState(() =>
    createPaymentRefresh({
      payment,
      current: () => alive.current,
      reads: {
        wallet: async () => {
          if (failures.current.wallet) throw new Error("synthetic-wallet");
        },
        history: async () => {
          if (failures.current.history) throw new Error("synthetic-history");
        },
      },
    }),
  );
  const results = useSyncExternalStore(
    refresh.subscribe,
    refresh.getSnapshot,
    refresh.getSnapshot,
  );
  useEffect(() => {
    alive.current = true;
    refresh.activate();
    void refresh.refresh();
    return () => {
      alive.current = false;
      refresh.dispose();
    };
  }, [refresh]);
  useFocusEffect(
    useCallback(() => {
      const listener = AppState.addEventListener("change", (next) => {
        if (next !== "active") refresh.pause();
      });
      return () => {
        refresh.pause();
        listener.remove();
      };
    }, [refresh]),
  );
  const scenario = (wallet: boolean, history: boolean) => {
    failures.current = { wallet, history };
    void refresh.refresh();
  };
  return (
    <>
      <PaymentStatusPanel
        state={state}
        onCheck={onCheck}
        refresh={results}
        onRefresh={(name) => void refresh.refresh(name)}
        qrRenderError={qrError}
      />
      <Button variant="paper" onPress={() => scenario(true, false)}>
        Mẫu lỗi cập nhật số dư
      </Button>
      <Button variant="paper" onPress={() => scenario(false, true)}>
        Mẫu lỗi cập nhật lịch sử
      </Button>
      <Button variant="paper" onPress={() => scenario(true, true)}>
        Mẫu lỗi cả hai cập nhật
      </Button>
      <Button variant="paper" onPress={() => scenario(false, false)}>
        Mẫu cập nhật thành công
      </Button>
    </>
  );
}
