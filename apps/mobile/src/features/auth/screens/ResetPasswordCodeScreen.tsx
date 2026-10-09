import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { AppError, errorMessage } from "@/lib/http/errors";
import { OtpInput } from "@/components/OtpInput";
import { useToast } from "@/providers/ToastProvider";
import { formValidationOptions } from "@/utils/form-validation";
import { AuthLayout } from "../components/AuthLayout";
import { OTP_REQUEST_ACKNOWLEDGMENT } from "../utils/otp-feedback";
import { authStyles } from "../components/AuthControls";
import { useAuthActions } from "../hooks/use-auth-actions";
import { useAuthFeedback } from "../hooks/use-auth-feedback";
import { useVerificationCooldown } from "../hooks/use-verification-cooldown";
import { passwordRecoveryStore } from "../utils/password-recovery-flow";
import { useAuthSession } from "../context/AuthSession";
import {
  recoveryCodeSchema,
  type RecoveryCodeFormValues,
} from "../schemas/auth-schemas";

export function ResetPasswordCodeScreen() {
  const router = useRouter();
  const { session } = useAuthSession();
  const params = useLocalSearchParams<{ sent?: string }>();
  const draft = useStore(passwordRecoveryStore, (state) => state.draft);
  const { forgot, verifyRecovery } = useAuthActions();
  const busy = forgot.isPending || verifyRecovery.isPending;
  const { showToast } = useToast();
  const cooldown = useVerificationCooldown(
    draft?.email ?? "",
    false,
    "recovery",
  );
  useAuthFeedback(
    params.sent === "true" && draft ? OTP_REQUEST_ACKNOWLEDGMENT : null,
  );
  const form = useForm<RecoveryCodeFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(recoveryCodeSchema),
    defaultValues: { otpCode: "" },
  });
  if (!draft) return <Redirect href="/forgot-password" />;
  if (draft.proof) return <Redirect href="/reset-password" />;

  const submit = form.handleSubmit(({ otpCode }) => {
    if (busy) return;
    Keyboard.dismiss();
    verifyRecovery.mutate(
      { email: draft.email, otpCode },
      {
        onSuccess: (proof) => {
          if (passwordRecoveryStore.getState().draft !== draft) return;
          if (!passwordRecoveryStore.getState().authorize(draft.email, proof))
            showToast(
              errorMessage(
                new AppError("http", 400, "RESET_TOKEN_INVALID_OR_EXPIRED"),
              ),
              "error",
            );
        },
      },
    );
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
              editable={!busy}
              onChangeText={(value) => {
                field.onChange(value);
                verifyRecovery.reset();
              }}
              onSubmitEditing={submit}
            />
          )}
        />
        <Button size="lg" onPress={submit} disabled={busy}>
          {verifyRecovery.isPending ? "Đang xác minh..." : "Tiếp tục"}
        </Button>
        <Button
          variant="secondary"
          disabled={busy || cooldown.seconds > 0}
          onPress={() => {
            if (busy || !cooldown.reserve()) return;
            forgot.mutate(draft.email, {
              onSuccess: () => {
                passwordRecoveryStore.getState().clearProof();
                verifyRecovery.reset();
                form.reset({ otpCode: "" });
                showToast(OTP_REQUEST_ACKNOWLEDGMENT, "success");
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
        {!session && (
          <Text style={authStyles.footer}>
            Nhập nhầm email?{" "}
            <Text
              accessibilityRole="link"
              style={authStyles.link}
              onPress={() => {
                if (!busy) passwordRecoveryStore.getState().clear();
              }}
            >
              Đổi email
            </Text>
          </Text>
        )}
        <Text
          accessibilityRole="link"
          style={[authStyles.link, { textAlign: "center" }]}
          onPress={() => {
            if (!busy) router.replace(session ? "/account-settings" : "/login");
          }}
        >
          {session ? "Quay lại cài đặt" : "Quay lại đăng nhập"}
        </Text>
      </View>
    </AuthLayout>
  );
}
