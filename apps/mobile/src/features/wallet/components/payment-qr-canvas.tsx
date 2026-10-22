import { Component, type ReactNode } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Button } from "@/components/Button";
import { Copy } from "./wallet-ui";
import type { paymentQrGeometry } from "../utils/payment-qr-encoder";

type Props = {
  geometry: NonNullable<ReturnType<typeof paymentQrGeometry>>;
  synthetic: boolean;
  onRetry: () => void;
};

// A local render fault never mutates Payment, starts a request or discards its ID.
export class PaymentQrCanvas extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render(): ReactNode {
    if (this.state.failed)
      return (
        <>
          <Copy>
            Chưa hiển thị được mã QR. Yêu cầu thanh toán vẫn được giữ.
          </Copy>
          <Button
            variant="paper"
            onPress={() => {
              this.props.onRetry();
              this.setState({ failed: false });
            }}
          >
            Thử lại hiển thị QR
          </Button>
        </>
      );
    const { geometry, synthetic } = this.props;
    return (
      <View
        testID="wallet-qr-image"
        accessibilityRole="image"
        accessibilityLabel={
          synthetic ? "Mã QR dữ liệu mẫu, không thanh toán" : "Mã QR thanh toán"
        }
        style={{
          width: geometry.side,
          height: geometry.side,
          alignSelf: "flex-start",
          marginLeft: geometry.offset,
          backgroundColor: "#ffffff",
        }}
      >
        <Svg
          width={geometry.side}
          height={geometry.side}
          viewBox={`0 0 ${geometry.units} ${geometry.units}`}
        >
          <Rect width={geometry.units} height={geometry.units} fill="#ffffff" />
          <Path d={geometry.path} fill="#000000" />
        </Svg>
      </View>
    );
  }
}
