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
import { Copy, Panel } from "@/components/feature-page";
import { AppError } from "@/lib/http/errors";
import { creditAmount, vndAmount } from "../utils/amount";
import { createPaymentObserver } from "../utils/payment-observer";
import { PaidRefresh } from "./status-refresh";
import { PaymentStatusPanel } from "../components/payment-status-panel";
import { previewPaymentStates } from "./fixtures";

export function WalletStatusPreview({
  initialState,
}: {
  initialState: string;
}) {
  const [selected, setSelected] = useState(initialState);
  return (
    <>
      <Panel title="Chọn bộ dữ liệu trạng thái mẫu">
        <Copy>
          Mỗi lựa chọn là một bộ dữ liệu độc lập, không mô phỏng chuyển trạng
          thái hoặc xác minh giao dịch thật.
        </Copy>
        {Object.entries(previewPaymentStates).map(([code, caption]) => (
          <Button key={code} variant="paper" onPress={() => setSelected(code)}>
            {caption}
          </Button>
        ))}
      </Panel>
      <StatusCase key={selected} code={selected} />
    </>
  );
}
function StatusCase({ code }: { code: string }) {
  const alive = useRef(true),
    mode = useRef("ok"),
    checks = useRef(0);
  const [qrError, setQrError] = useState(false);
  const [observer] = useState(() => {
    const target = {
      scope: { ownerId: "preview-status-only", generation: 0 },
      paymentId: "preview-observation-only",
      amountVnd: vndAmount("123000"),
      credit: creditAmount("123.00"),
    };
    return createPaymentObserver({
      scope: target.scope,
      target,
      current: () => alive.current,
      read: async (requested) => {
        checks.current++;
        if (mode.current === "error") throw new AppError("network");
        if (mode.current === "denied") throw new AppError("http", 403);
        if (mode.current === "missing") throw new AppError("http", 404);
        return {
          scope: requested.scope,
          payment: {
            paymentId: requested.paymentId,
            amountVnd: requested.amountVnd,
            credit: requested.credit,
            state:
              mode.current === "conflict"
                ? code === "PAID"
                  ? "PENDING"
                  : "PAID"
                : code,
          },
        };
      },
    });
  });
  const state = useSyncExternalStore(
    observer.subscribe,
    observer.getSnapshot,
    observer.getSnapshot,
  );
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      observer.activate();
      observer.resume();
      void observer.check();
      const subscription = AppState.addEventListener("change", (next) => {
        if (next !== "active") observer.pause();
        else {
          observer.resume();
          void observer.check();
        }
      });
      return () => {
        observer.pause();
        subscription.remove();
      };
    }, [observer]),
  );
  useEffect(
    () => () => {
      alive.current = false;
      observer.dispose();
    },
    [observer],
  );
  const scenario = (value: string) => {
    mode.current = value;
    void observer.check();
  };
  return (
    <>
      <Copy>
        Đây chỉ là trạng thái minh họa. Không xác minh thanh toán và không cộng
        Credit vào ví thật.
      </Copy>
      {state.data?.state === "PAID" ? (
        <PaidRefresh
          payment={state.data}
          state={state}
          onCheck={() => void observer.check()}
          qrError={qrError}
        />
      ) : (
        <PaymentStatusPanel
          state={state}
          onCheck={
            observer.canCheck() ? () => void observer.check() : undefined
          }
          qrRenderError={qrError}
        />
      )}
      <Panel title="Thử lỗi đọc mẫu">
        <Button variant="paper" onPress={() => scenario("error")}>
          Mẫu lỗi đọc
        </Button>
        <Button variant="paper" onPress={() => scenario("denied")}>
          Mẫu bị từ chối truy cập
        </Button>
        <Button variant="paper" onPress={() => scenario("missing")}>
          Mẫu không tìm thấy
        </Button>
        <Button variant="paper" onPress={() => scenario("conflict")}>
          Mẫu kết quả mâu thuẫn
        </Button>
        <Button variant="paper" onPress={() => scenario("ok")}>
          Mẫu đọc đúng
        </Button>
        <Button variant="paper" onPress={() => setQrError((value) => !value)}>
          Bật/tắt lỗi mã minh họa
        </Button>
        <Copy>
          Số lần kiểm tra model: {checks.current}. Không có HTTP thanh toán.
        </Copy>
      </Panel>
    </>
  );
}
