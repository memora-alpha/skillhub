import { useMemo, useState } from "react";
import { PixelRatio, View } from "react-native";
import { Button } from "@/components/Button";
import { Copy, Panel } from "./wallet-ui";
import type { QrPresentation } from "../utils/payment-qr-model";
import {
  encodePaymentQr,
  paymentQrGeometry,
} from "../utils/payment-qr-encoder";
import { PaymentQrCanvas } from "./payment-qr-canvas";

const captions = {
  preparing: "Đang chuẩn bị nội dung mã QR.",
  unavailable: "Chưa có mã thanh toán để hiển thị.",
  "ready-model": "Mã QR được dựng trực tiếp từ dữ liệu đã nhận.",
  "render-error": "Chưa hiển thị được mã QR. Yêu cầu vẫn được giữ lại.",
};
export function PaymentQr({
  model,
  synthetic = false,
  onRetryPresentation,
}: {
  model: QrPresentation;
  synthetic?: boolean;
  onRetryPresentation?: () => void;
}) {
  const [width, setWidth] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const raw = model.stage === "ready-model" ? model.raw : undefined;
  const encoded = useMemo(
    () => (raw === undefined ? undefined : encodePaymentQr(raw)),
    // A deliberate local retry must not trigger a read/create or a new identity.
    [raw, attempt],
  );
  const geometry =
    encoded?.kind === "ready"
      ? paymentQrGeometry(encoded, width, PixelRatio.get())
      : null;
  const retry = () => {
    setAttempt((old) => old + 1);
    onRetryPresentation?.();
  };
  const failed =
    encoded?.kind === "error" || (width > 0 && encoded && !geometry);
  return (
    <Panel title="Mã thanh toán">
      {synthetic && <Copy>QR MẪU · KHÔNG DÙNG ĐỂ THANH TOÁN</Copy>}
      <Copy>{captions[model.stage]}</Copy>
      {model.paymentId && <Copy>Mã yêu cầu: {model.paymentId}</Copy>}
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ width: "100%" }}
      >
        {geometry && (
          <PaymentQrCanvas
            key={attempt}
            geometry={geometry}
            synthetic={synthetic}
            onRetry={retry}
          />
        )}
      </View>
      {failed && (
        <>
          <Copy>
            Chưa thể dựng mã QR với dữ liệu hoặc kích thước này. Yêu cầu vẫn
            được giữ; có thể kiểm tra trạng thái thanh toán.
          </Copy>
          <Button variant="paper" onPress={retry}>
            Thử lại hiển thị QR
          </Button>
        </>
      )}
      <Copy muted>
        {synthetic
          ? "Mã chỉ chứa dữ liệu tổng hợp, không gọi dịch vụ tài chính. "
          : "Dùng thiết bị thứ hai để quét mã khi thanh toán khả dụng. "}
        Đóng màn hình hoặc lỗi QR không xác nhận hay hủy thanh toán.
      </Copy>
    </Panel>
  );
}
