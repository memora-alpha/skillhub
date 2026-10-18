import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";
import { Copy, Panel } from "../components/wallet-ui";
import { TopupForm } from "../components/topup-form";
import { PaymentQr } from "../components/payment-qr";
import { createPaymentPreparation } from "../utils/payment-intent";
import { createQrPresentation } from "../utils/payment-qr-model";
import type { ModelDispatch } from "../types/payment";

// Isolated synthetic model; no account runtime, query client or financial HTTP.
export function WalletPreparationPreview({
  view,
}: {
  view: "topup" | "payment";
}) {
  const [display, setDisplay] = useState(view);
  const [model] = useState(() =>
    createPaymentPreparation({
      scope: { ownerId: "preview-only", generation: 0 },
      isCurrent: () => true,
    }),
  );
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const [mode, setMode] = useState<"created" | "unknown" | "rejected">(
    "created",
  );
  const [dispatches, setDispatches] = useState(0);
  useEffect(() => {
    model.activate();
    return model.dispose;
  }, [model]);
  const dispatch: ModelDispatch = async (intent) => {
    setDispatches((count) => count + 1);
    if (mode === "unknown") throw new Error("Synthetic timeout only");
    return {
      kind: mode === "created" ? "created" : "rejected-with-no-creation",
      scope: intent.scope,
      intentId: intent.localId,
      review: intent.review,
      ...(mode === "created" ? { paymentId: "preview-payment-model" } : {}),
    };
  };
  return (
    <>
      <Copy>
        Dữ liệu mẫu độc lập · không gửi thanh toán, không cập nhật ví thật.
      </Copy>
      {display === "topup" && (
        <>
          <Panel title="Tình huống minh họa">
            <Button
              variant="paper"
              disabled={state.stage !== "DRAFT"}
              onPress={() => setMode("created")}
            >
              Mẫu tạo được ID
            </Button>
            <Button
              variant="paper"
              disabled={state.stage !== "DRAFT"}
              onPress={() => setMode("unknown")}
            >
              Mẫu chưa rõ kết quả
            </Button>
            <Button
              variant="paper"
              disabled={state.stage !== "DRAFT"}
              onPress={() => setMode("rejected")}
            >
              Mẫu từ chối chưa tạo
            </Button>
            <Copy>
              Đang chọn:{" "}
              {mode === "created"
                ? "Tạo được ID mẫu"
                : mode === "unknown"
                  ? "Chưa rõ kết quả mẫu"
                  : "Từ chối chưa tạo mẫu"}
            </Copy>
          </Panel>
          <TopupForm model={model} previewDispatch={dispatch} />
        </>
      )}
      <Copy>
        Số lần gọi model mẫu: {dispatches} · HTTP thanh toán: 0 · Ghi sổ thật:
        chưa kiểm thử.
      </Copy>
      {display === "payment" && state.paymentId && (
        <QrPreview paymentId={state.paymentId} />
      )}
      {display === "payment" && !state.paymentId && (
        <PaymentQr model={{ stage: "preparing" }} synthetic />
      )}
      {display === "topup" && state.paymentId && (
        <Button variant="paper" onPress={() => setDisplay("payment")}>
          Xem màn thanh toán mẫu
        </Button>
      )}
      {display === "payment" && (
        <Button variant="paper" onPress={() => setDisplay("topup")}>
          Về số tiền mẫu
        </Button>
      )}
    </>
  );
}
function QrPreview({ paymentId }: { paymentId: string }) {
  const [qr] = useState(() => createQrPresentation(paymentId));
  const state = useSyncExternalStore(
    qr.subscribe,
    qr.getSnapshot,
    qr.getSnapshot,
  );
  const raw = "  synthetic-only · ĐỒNG\n0001  ";
  useEffect(() => {
    qr.activate();
    qr.readyModel(raw);
    return qr.dispose;
  }, [qr]);
  return (
    <>
      <PaymentQr
        model={state}
        synthetic
        onRetryPresentation={qr.retryPresentation}
      />
      <Button variant="paper" onPress={qr.renderError}>
        Minh họa lỗi hiển thị
      </Button>
      <Button variant="paper" onPress={qr.retryPresentation}>
        Thử lại hiển thị mẫu
      </Button>
      <Button variant="paper" onPress={qr.close}>
        Đóng nội dung mã mẫu
      </Button>
      <Button variant="paper" onPress={() => qr.readyModel(raw)}>
        Mở lại nội dung mẫu
      </Button>
      <Copy>
        Trạng thái thanh toán mẫu chưa được kiểm tra. Lỗi mã hoặc đóng màn hình
        không quyết định kết quả.
      </Copy>
    </>
  );
}
