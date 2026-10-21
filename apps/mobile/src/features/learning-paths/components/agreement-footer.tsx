import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function AgreementFooter({
  conversationId,
  children,
  review,
}: Readonly<{
  conversationId: string;
  children?: ReactNode;
  review?: { label: string; onPress: () => void; disabled?: boolean };
}>) {
  const router = useRouter();
  return (
    <View style={styles.footer}>
      {children}
      <Button
        variant="white"
        style={styles.chat}
        accessibilityLabel="Trao đổi qua chat"
        onPress={() =>
          router.dismissTo({
            pathname: "/chat/[proposalId]",
            params: { proposalId: conversationId, mode: "api" },
          })
        }
      >
        <Icon name="message" size={18} color={colors.muted} />
        <Text style={styles.chatLabel}>Trao đổi qua chat</Text>
      </Button>
      {review && (
        <Button
          variant="ghost"
          size="sm"
          style={styles.review}
          accessibilityLabel={review.label}
          disabled={review.disabled}
          onPress={review.onPress}
        >
          <View
            style={
              review.label !== "Chỉnh sửa cách học"
                ? styles.backIcon
                : undefined
            }
          >
            <Icon
              name={review.label === "Chỉnh sửa cách học" ? "edit" : "arrow"}
              size={16}
              color={colors.muted}
            />
          </View>
          <Text style={styles.reviewLabel}>{review.label}</Text>
        </Button>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  footer: { gap: 10, paddingTop: 8 },
  primary: { minHeight: 50, borderRadius: appRadius.card },
  chat: {
    minHeight: 48,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chatLabel: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.inkSoft,
    flexShrink: 1,
    textAlign: "center",
  },
  review: { minHeight: 44, alignSelf: "center", maxWidth: "100%" },
  reviewLabel: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
    flexShrink: 1,
    textAlign: "center",
  },
  backIcon: { transform: [{ rotate: "180deg" }] },
});
export const agreementFooterPrimaryStyle = styles.primary;
