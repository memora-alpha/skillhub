import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { OtpInput } from "@/components/OtpInput";
import { useToast } from "@/providers/ToastProvider";
import { formValidationOptions } from "@/utils/form-validation";
import { AuthLayout } from "../components/AuthLayout";
import { authStyles } from "../components/AuthControls";
import { useAuthActions } from "../hooks/use-auth-actions";
import { useAuthFeedback } from "../hooks/use-auth-feedback";
import { useVerificationCooldown } from "../hooks/use-verification-cooldown";
import { passwordRecoveryStore } from "../utils/password-recovery-flow";
import {
  recoveryCodeSchema,
  type RecoveryCodeFormValues,
} from "../schemas/auth-schemas";

export function ResetPasswordCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sent?: string }>();
  const draft = useStore(passwordRecoveryStore, (state) => state.draft);
  const { forgot } = useAuthActions();
  const { showToast } = useToast();
  const cooldown = useVerificationCooldown(
    draft?.email ?? "",
    false,
    "recovery",
  );
  useAuthFeedback(
    params.sent === "true" && draft
      ? "Nếu địa chỉ đủ điều kiện, mã khôi phục đã được gửi."
      : null,
  );
  const form = useForm<RecoveryCodeFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(recoveryCodeSchema),
    defaultValues: { otpCode: draft?.otpCode ?? "" },
  });
  if (!draft) return <Redirect href="/forgot-password" />;

  const submit = form.handleSubmit(({ otpCode }) => {
    if (forgot.isPending) return;
    Keyboard.dismiss();
    // TODO: replace draft collection with the future recovery verification API.
    if (passwordRecoveryStore.getState().setCode(otpCode))
      router.replace("/reset-password");
  });

  return (
    <AuthLayout
      title="Nhập mã xác minh"
      subtitle="Nhập mã 6 chữ số trong email để tiếp tục đặt lại mật khẩu."
    >
      <View style={authStyles.fields}>
        <Input
          label="Email"
          value={draft.email}
          editable={false}
          autoComplete="off"
        />
        <Controller
          control={form.control}
          name="otpCode"
          render={({ field, fieldState }) => (
            <OtpInput
              ref={field.ref}
              value={field.value}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              editable={!forgot.isPending}
              onChangeText={field.onChange}
              onSubmitEditing={submit}
            />
          )}
        />
        <Button size="lg" onPress={submit} disabled={forgot.isPending}>
          Tiếp tục
        </Button>
        <Button
          variant="secondary"
          disabled={forgot.isPending || cooldown.seconds > 0}
          onPress={() => {
            if (forgot.isPending || !cooldown.reserve()) return;
            forgot.mutate(draft.email, {
              onSuccess: () => {
                passwordRecoveryStore.getState().clearCode();
                form.reset({ otpCode: "" });
                showToast(
                  "Nếu địa chỉ đủ điều kiện, mã mới đã được gửi.",
                  "success",
                );
              },
            });
          }}
        >
          {forgot.isPending
            ? "Đang gửi..."
            : cooldown.seconds > 0
              ? `Gửi lại mã sau ${cooldown.seconds}s`
              : "Gửi lại mã"}
        </Button>
        <Text style={authStyles.footer}>
          Nhập nhầm email?{" "}
          <Text
            accessibilityRole="link"
            style={authStyles.link}
            onPress={() => {
              if (!forgot.isPending) passwordRecoveryStore.getState().clear();
            }}
          >
            Đổi email
          </Text>
        </Text>
        <Text
          accessibilityRole="link"
          style={[authStyles.link, { textAlign: "center" }]}
          onPress={() => {
            if (!forgot.isPending) router.replace("/login");
          }}
        >
          Quay lại đăng nhập
        </Text>
      </View>
    </AuthLayout>
  );
}
