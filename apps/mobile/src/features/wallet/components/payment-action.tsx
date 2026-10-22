import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import type { IconName } from "@/components/Icon";

// Payment uses the same button variants, type ramp and dimensions as the app.
export function PaymentAction({
  children,
  onPress,
  variant = "craft",
  disabled = false,
  icon,
}: {
  children: string;
  onPress: () => void;
  variant?: "craft" | "paper" | "ghost";
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Button
      variant={variant}
      size={variant === "ghost" ? "md" : "lg"}
      disabled={disabled}
      accessibilityLabel={children}
      onPress={onPress}
      icon={icon}
    >
      {children}
    </Button>
  );
}
export function PaymentReturnAction({ success }: { success: boolean }) {
  const router = useRouter();
  return (
    <PaymentAction
      variant={success ? "craft" : "ghost"}
      icon={success ? "check" : undefined}
      onPress={() => router.dismissTo("/wallet")}
    >
      {success ? "Hoàn tất" : "Về ví Credit"}
    </PaymentAction>
  );
}
