import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { paymentDeadline } from "../utils/payment-deadline";
import { checkoutStyles as styles } from "./payment-checkout.styles";
import { paymentPalette as colors } from "./wallet-payment-palette";

export function PaymentDeadline({
  expiresAt,
  active,
}: {
  expiresAt: string | null;
  active: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active || !expiresAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, expiresAt]);
  const view = paymentDeadline(expiresAt, now);
  return (
    <View style={styles.deadline} testID="payment-deadline">
      <View style={styles.deadlineIcon}>
        <Icon name="clock" size={16} color={colors.warning} />
      </View>
      <Text style={styles.deadlineTitle}>
        {view.kind === "countdown" ? "Mã QR còn hiệu lực" : "Thời hạn mã QR"}
      </Text>
      <Text style={styles.timer}>{view.label}</Text>
    </View>
  );
}
