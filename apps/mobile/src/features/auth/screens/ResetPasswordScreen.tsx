import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { formValidationOptions } from "@/utils/form-validation";
import { AppError, errorMessage } from "@/lib/http/errors";
import { useToast } from "@/providers/ToastProvider";
import { isResetTokenRejected } from "../utils/otp-feedback";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordRequirements, authStyles } from "../components/AuthControls";
import { AuthFormInput } from "../components/AuthFormInput";
import { useAuthActions } from "../hooks/use-auth-actions";
import {
  newPasswordSchema,
  type NewPasswordFormValues,
} from "../schemas/auth-schemas";
import { passwordRecoveryStore } from "../utils/password-recovery-flow";

export function ResetPasswordScreen() {
  const router = useRouter();
  const draft = useStore(passwordRecoveryStore, (state) => state.draft);
  const { reset } = useAuthActions();
  const { showToast } = useToast();
  const form = useForm<NewPasswordFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmNewPassword: "",
    },
  });
  const password = form.watch("newPassword");
  if (reset.isSuccess)
    return (
      <Redirect
        href={{
          pathname: "/login",
          params: { email: reset.variables.email, result: "reset" },
        }}
      />
    );
  if (!draft) return <Redirect href="/forgot-password" />;
  if (!draft.proof) return <Redirect href="/forgot-password" />;
  const submit = form.handleSubmit((values) => {
    if (reset.isPending || !draft.proof) return;
    if (Date.parse(draft.proof.expiresAt) <= Date.now()) {
      showToast(
        errorMessage(
          new AppError("http", 400, "RESET_TOKEN_INVALID_OR_EXPIRED"),
        ),
        "error",
      );
      passwordRecoveryStore.getState().clearProof();
      return;
    }
    Keyboard.dismiss();
    reset.mutate(
      {
        ...values,
        email: draft.email,
        resetToken: draft.proof.resetToken,
      },
      {
        onSuccess: () => passwordRecoveryStore.getState().clear(),
        onError: (error) => {
          if (isResetTokenRejected(error))
            passwordRecoveryStore.getState().clearProof();
        },
      },
    );
  });
  return (
    <AuthLayout
      title="Đặt mật khẩu mới"
      subtitle="Chọn mật khẩu mới cho tài khoản của bạn."
    >
      <View style={authStyles.fields}>
        <AuthFormInput
          control={form.control}
          name="newPassword"
          label="Mật khẩu mới"
          required
          password
          editable={!reset.isPending}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={() => {
            reset.reset();
            if (form.getFieldState("confirmNewPassword").isTouched)
              void form.trigger("confirmNewPassword");
          }}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => form.setFocus("confirmNewPassword")}
        />
        <PasswordRequirements password={password} />
        <AuthFormInput
          control={form.control}
          name="confirmNewPassword"
          label="Xác nhận mật khẩu mới"
          required
          password
          editable={!reset.isPending}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={reset.reset}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button size="lg" onPress={submit} disabled={reset.isPending}>
          {reset.isPending ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
        </Button>
        <Text style={authStyles.footer}>
          Quay lại{" "}
          <Text
            accessibilityRole="link"
            style={authStyles.link}
            onPress={() => {
              if (!reset.isPending)
                router.replace({
                  pathname: "/login",
                  params: { email: draft.email },
                });
            }}
          >
            đăng nhập
          </Text>
        </Text>
      </View>
    </AuthLayout>
  );
}
