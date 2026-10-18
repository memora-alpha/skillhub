import { useCallback, useState, useSyncExternalStore } from "react";
import { AppState, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Button } from "@/components/Button";
import { Copy, Panel } from "../components/wallet-ui";
import { PaymentQr } from "../components/payment-qr";
import { createQrPreviewHost } from "./qr-host";

export function WalletQrPreview() {
  const [host] = useState(createQrPreviewHost);
  const state = useSyncExternalStore(
    host.subscribe,
    host.getSnapshot,
    host.getSnapshot,
  );
  useFocusEffect(
    useCallback(() => {
      host.activate();
      host.load("ascii");
      const subscription = AppState.addEventListener("change", (next) => {
        if (next !== "active") host.dispose();
        else host.activate();
      });
      return () => {
        subscription.remove();
        host.dispose();
      };
    }, [host]),
  );
  const cases = [
    ["ascii", "QR mẫu ASCII"],
    ["unicode", "QR mẫu Unicode"],
    ["dense", "QR mẫu dày"],
    ["markup", "QR mẫu ký tự đặc biệt"],
    ["overCapacity", "QR mẫu quá capacity"],
    ["invalid", "QR mẫu UTF-16 lỗi"],
  ] as const;
  return (
    <View testID="wallet-qr-preview" style={{ gap: 16 }}>
      <Panel title="QR local · mẫu độc lập">
        <Copy>
          Chỉ dữ liệu tổng hợp, độc lập tạo yêu cầu nạp. Không gọi API tài
          chính, không ghi cache tài khoản.
        </Copy>
        <Copy>{`Owner mẫu ${state.owner} · version ${state.version} · ${state.status}`}</Copy>
        <Copy>Số tiền mẫu: 123.000 VND · Credit mẫu: 123,00 CR</Copy>
        {cases.map(([name, label]) => (
          <Button key={name} variant="paper" onPress={() => host.load(name)}>
            {label}
          </Button>
        ))}
      </Panel>
      <PaymentQr
        model={state.model}
        synthetic
        onRetryPresentation={host.retry}
      />
      <Panel title="Kiểm tra QR mẫu">
        <Button variant="paper" onPress={host.hide}>
          Ẩn QR mẫu cùng version
        </Button>
        <Button variant="paper" onPress={host.restore}>
          Response QR mẫu cũ
        </Button>
        <Button variant="paper" onPress={host.newer}>
          QR mẫu version mới
        </Button>
        <Button variant="paper" onPress={host.fail}>
          Lỗi render QR mẫu
        </Button>
        <Button variant="paper" onPress={host.retry}>
          Thử lại render QR mẫu
        </Button>
        <Button variant="paper" onPress={host.close}>
          Đóng QR mẫu
        </Button>
        <Button variant="paper" onPress={host.reopen}>
          Mở lại QR mẫu
        </Button>
        <Button variant="paper" onPress={host.deny}>
          Từ chối owner QR mẫu
        </Button>
        <Button variant="paper" onPress={host.switchOwner}>
          Đổi owner QR mẫu
        </Button>
        <Button variant="paper" onPress={host.late}>
          Response owner QR cũ
        </Button>
        <Button variant="paper" onPress={host.paid}>
          PAID mẫu · chỉ observation
        </Button>
        <Copy>
          HTTP thanh toán: 0 · Ghi sổ thật: chưa kiểm thử. QR mẫu không chứng
          minh payOS hoặc thiết bị ngân hàng hoạt động.
        </Copy>
      </Panel>
    </View>
  );
}
