import { Copy, Panel } from "@/components/feature-page";
import type { QrPresentation } from "../utils/payment-qr-model";

const captions = {
  preparing: "Đang chuẩn bị nội dung mã minh họa.",
  unavailable: "Chưa có mã thanh toán để hiển thị.",
  "ready-model": "Dữ liệu minh họa đã sẵn sàng; chưa dựng mã QR có thể quét.",
  "render-error":
    "Chưa hiển thị được mã minh họa. Yêu cầu mẫu vẫn được giữ lại.",
};
export function PaymentQr({ model }: { model: QrPresentation }) {
  return (
    <Panel title="Mã thanh toán">
      <Copy>{captions[model.stage]}</Copy>
      {model.paymentId && <Copy>Mã yêu cầu mẫu: {model.paymentId}</Copy>}
      <Copy muted>
        Chưa có mã QR có thể quét. Đóng màn hình này không xác nhận hoặc hủy
        thanh toán.
      </Copy>
    </Panel>
  );
}
