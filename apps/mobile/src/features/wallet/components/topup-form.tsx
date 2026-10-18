import { useSyncExternalStore } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Copy, Panel, WalletField } from "./wallet-ui";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  signedInChrome,
  typography,
} from "@/constants/theme";
import { amountHint, validateTopUp } from "../utils/topup-policy";
import { formatCredit, formatVnd } from "../utils/amount";
import type { PaymentPreparation } from "../utils/payment-intent";
import type { ModelDispatch } from "../types/payment";

const schema = z.object({
  amountText: z.string().refine((text) => {
    try {
      validateTopUp(text);
      return true;
    } catch {
      return false;
    }
  }, amountHint),
});
export function TopupForm({
  model,
  previewDispatch,
}: {
  model: PaymentPreparation;
  previewDispatch?: ModelDispatch;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const form = useForm({
    defaultValues: { amountText: state.draft.amountText },
    resolver: zodResolver(schema),
  });
  const review = state.review;
  const editable = state.stage === "DRAFT" || state.stage === "REVIEW";
  const amountText = form.watch("amountText");
  let estimate: string | undefined;
  try {
    estimate = formatCredit(validateTopUp(amountText).estimatedCredit);
  } catch {
    /* Incomplete input has no estimate. */
  }
  return (
    <Panel title={review ? "Thông tin nạp Credit" : "Số tiền nạp"}>
      {!review && (
        <>
          <Controller
            control={form.control}
            name="amountText"
            render={({ field, fieldState }) => (
              <Input
                ref={field.ref}
                label="Số tiền nạp (VND)"
                value={field.value}
                onChangeText={(text) => {
                  field.onChange(text);
                  model.edit(text);
                }}
                onBlur={field.onBlur}
                editable={editable}
                keyboardType="number-pad"
                inputMode="numeric"
                autoCorrect={false}
                placeholder="Ví dụ: 100000"
                style={styles.amountInput}
                hint="Từ 1.000 đến 2.000.000 VND · Bước 1.000 VND"
                error={fieldState.error?.message ?? state.error}
              />
            )}
          />
          <View style={styles.presets}>
            {["50000", "100000", "200000", "500000"].map((amount) => (
              <Pressable
                key={amount}
                accessibilityRole="button"
                accessibilityLabel={`Chọn ${formatVnd(amount)}`}
                aria-pressed={amountText === amount}
                accessibilityState={{
                  selected: amountText === amount,
                  disabled: !editable,
                }}
                disabled={!editable}
                onPress={() => {
                  form.setValue("amountText", amount, { shouldValidate: true });
                  model.edit(amount);
                }}
                style={({ pressed }) => [
                  styles.preset,
                  amountText === amount && styles.selected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    amountText === amount && styles.selectedText,
                  ]}
                >
                  {formatVnd(amount)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.estimate}>
            <Text style={styles.caption}>Credit ước tính</Text>
            <Text style={styles.estimateValue}>
              {estimate ?? "Chưa có số tiền hợp lệ"}
            </Text>
          </View>
        </>
      )}
      {review && (
        <>
          <View style={styles.review}>
            <Text style={styles.caption}>Số tiền nạp</Text>
            <Text selectable style={styles.reviewAmount}>
              {formatVnd(review.amountVnd)}
            </Text>
            <WalletField
              label="Credit ước tính"
              value={formatCredit(review.estimatedCredit)}
            />
          </View>
          <Copy muted>
            {review.provenance === "confirmed-model"
              ? "Thông tin xác nhận minh họa; không phải báo giá cho tài khoản thật."
              : "Chưa có báo giá được máy chủ xác nhận. Credit ước tính chưa được cộng vào ví."}
          </Copy>
          {review.quote && (
            <Copy>Thời hạn xác nhận mẫu: {review.quote.expiresAt}</Copy>
          )}
        </>
      )}
      <View style={styles.method}>
        <View style={styles.methodIcon}>
          <Icon name="shield" color={colors.forest} size={22} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.methodName}>Thanh toán qua payOS</Text>
          <Text style={styles.caption}>Quét mã QR · 1.000 VND = 1 Credit</Text>
        </View>
      </View>
      {state.stage === "DRAFT" && (
        <Button
          variant="craft"
          size="lg"
          onPress={() => {
            void form.handleSubmit(
              () => model.review(),
              () => model.review(),
            )();
          }}
        >
          Tiếp tục
        </Button>
      )}
      {state.stage === "REVIEW" && (
        <>
          <Button
            variant="craft"
            size="lg"
            disabled={!previewDispatch || state.stage !== "REVIEW"}
            onPress={() => {
              if (previewDispatch) void model.confirmModel(previewDispatch);
            }}
          >
            {previewDispatch
              ? "Xác nhận mẫu · không thanh toán"
              : "Xác nhận nạp Credit"}
          </Button>
          <Button variant="ghost" onPress={model.backToDraft}>
            Thay đổi số tiền
          </Button>
        </>
      )}
      {state.stage === "CREATING" && (
        <FormNotice tone="info">Đang xử lý yêu cầu minh họa…</FormNotice>
      )}
      {state.stage === "UNKNOWN_OUTCOME" && (
        <FormNotice tone="error">
          Chưa xác định yêu cầu đã được tạo hay chưa. Không tạo lại yêu cầu; bạn
          có thể quay về ví.
        </FormNotice>
      )}
      {state.stage === "REJECTED_WITH_NO_CREATION" && (
        <>
          <FormNotice tone="error">
            Yêu cầu mẫu chưa được tạo. Số tiền đã nhập được giữ lại.
          </FormNotice>
          <Button variant="paper" onPress={model.startNext}>
            Sửa yêu cầu mẫu
          </Button>
        </>
      )}
      {state.stage === "CREATED_WITH_ID" && (
        <Copy>Đã tạo yêu cầu mẫu. Chưa xác nhận thanh toán.</Copy>
      )}
      {state.stage === "SESSION_ENDED" && (
        <FormNotice tone="info">
          Phiên đã kết thúc. Vui lòng đăng nhập lại.
        </FormNotice>
      )}
      {!previewDispatch && (
        <Copy muted>
          Nạp Credit đang được hoàn thiện. Bạn có thể xem lại số tiền; chưa có
          yêu cầu thanh toán nào được gửi.
        </Copy>
      )}
    </Panel>
  );
}
const styles = StyleSheet.create({
  amountInput: {
    fontFamily: fonts.bold,
    ...typography.title,
    fontVariant: ["tabular-nums"],
  },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    minHeight: 44,
    minWidth: 108,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: appRadius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: signedInChrome.accent,
    backgroundColor: colors.primarySoft,
  },
  presetText: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
  },
  selectedText: { color: colors.primaryDark },
  pressed: { opacity: 0.7 },
  estimate: {
    padding: 16,
    borderRadius: appRadius.control,
    backgroundColor: colors.forestSoft,
    gap: 4,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  estimateValue: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.forest,
  },
  review: { gap: 8, paddingVertical: 8 },
  reviewAmount: {
    fontFamily: fonts.bold,
    ...typography.title,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  method: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  methodIcon: {
    padding: 10,
    borderRadius: appRadius.control,
    backgroundColor: colors.forestSoft,
  },
  methodName: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
  },
  grow: { flex: 1, minWidth: 0, gap: 4 },
});
