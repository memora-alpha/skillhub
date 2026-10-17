import { View } from "react-native";
import { Button } from "@/components/Button";
import { Copy, Panel } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { FinancialReadState } from "./financial-read-state";
import { formatCredit, formatVnd } from "../utils/amount";
import { paymentOutcome } from "../utils/payment-outcome";
import type {
  PaymentObservationRead,
  PaymentRefreshSnapshot,
  RelatedRead,
} from "../types/payment";

const refreshCaption: Record<RelatedRead["status"], string> = {
  unavailable: "Chưa sẵn sàng",
  idle: "Chưa cập nhật",
  loading: "Đang cập nhật…",
  success: "Đã cập nhật",
  error: "Chưa cập nhật được",
};
export function PaymentStatusPanel({
  state,
  onCheck,
  refresh,
  onRefresh,
  qrRenderError = false,
}: {
  state: PaymentObservationRead;
  onCheck?: () => void;
  refresh?: PaymentRefreshSnapshot;
  onRefresh?: (name: "wallet" | "history") => void;
  qrRenderError?: boolean;
}) {
  const data = state.data;
  const busy = state.status === "loading" || state.status === "refreshing";
  return (
    <Panel title="Trạng thái thanh toán">
      <FinancialReadState
        state={state}
        unavailableMessage="Chưa thể kiểm tra thanh toán. Thông tin từ liên kết, mã QR hoặc việc quay lại ứng dụng không xác nhận giao dịch."
      >
        {data && (
          <View style={{ gap: 12 }}>
            <Copy>{paymentOutcome(data.state)}</Copy>
            <Copy>Mã yêu cầu: {data.paymentId}</Copy>
            <Copy>Số tiền đã ghi nhận: {formatVnd(data.amountVnd)}</Copy>
            <Copy>
              Credit theo thông tin thanh toán: {formatCredit(data.credit)}
            </Copy>
            {["CREATED", "PENDING"].includes(data.state) && (
              <Copy muted>
                Đang chờ kết quả xác minh. Thời gian chờ không quyết định thất
                bại hoặc hết hạn.
              </Copy>
            )}
            {data.state === "REFUNDED" && (
              <Copy muted>
                Chỉ hiển thị thông tin đã được ghi nhận; không xác định số tiền
                hoàn hoặc thao tác rút tiền.
              </Copy>
            )}
            {state.stale && (
              <FormNotice tone="info">
                Đang hiển thị kết quả trước đó. Thông tin này chưa được cập
                nhật.
              </FormNotice>
            )}
            {state.issue === "conflict" && (
              <Copy>
                Thông tin mới chưa thể đối chiếu. Kết quả trước đó được giữ lại
                để kiểm tra tiếp.
              </Copy>
            )}
            {data.state === "PAID" && refresh && (
              <>
                <Copy>
                  Thanh toán đã được xác nhận; việc cập nhật số dư và lịch sử
                  được kiểm tra riêng.
                </Copy>
                {(["wallet", "history"] as const).map((name) => (
                  <View key={name} style={{ gap: 8 }}>
                    <Copy>
                      {name === "wallet" ? "Số dư" : "Lịch sử"}:{" "}
                      {refreshCaption[refresh[name].status]}
                      {refresh[name].stale
                        ? " · dữ liệu trước đó có thể đã cũ"
                        : ""}
                    </Copy>
                    {onRefresh &&
                      ["idle", "error"].includes(refresh[name].status) && (
                        <Button variant="paper" onPress={() => onRefresh(name)}>
                          {name === "wallet"
                            ? "Cập nhật lại số dư"
                            : "Cập nhật lại lịch sử"}
                        </Button>
                      )}
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </FinancialReadState>
      {onCheck && (
        <Button variant="paper" disabled={busy} onPress={onCheck}>
          {busy ? "Đang kiểm tra…" : "Kiểm tra lại"}
        </Button>
      )}
      {qrRenderError && (
        <Copy>
          Chưa hiển thị được mã minh họa. Lỗi hiển thị mã không thay đổi kết quả
          thanh toán đã ghi nhận.
        </Copy>
      )}
    </Panel>
  );
}
