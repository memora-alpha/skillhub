import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { OtpInput } from "@/components/OtpInput";
import { formValidationOptions } from "@/utils/form-validation";
import { useAuthFeedback } from "../hooks/use-auth-feedback";
import { AuthLayout } from "../components/AuthLayout";
import { OTP_REQUEST_ACKNOWLEDGMENT } from "../utils/otp-feedback";
import { authStyles } from "../components/AuthControls";
import { AuthFormInput } from "../components/AuthFormInput";
import { useAuthActions } from "../hooks/use-auth-actions";
import { useVerificationCooldown } from "../hooks/use-verification-cooldown";
import {
  verifyEmailSchema,
  type VerifyEmailFormValues,
} from "../schemas/auth-schemas";

export function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; sent?: string }>();
  const email =
    typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  const hasValidEmail = verifyEmailSchema.shape.email.safeParse(email).success;
  const { verify, resend } = useAuthActions();
  const cooldown = useVerificationCooldown(
    email,
    params.sent === "true" && hasValidEmail,
  );
  useAuthFeedback(
    params.sent === "true" && hasValidEmail ? OTP_REQUEST_ACKNOWLEDGMENT : null,
  );
  const form = useForm<VerifyEmailFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email,
      otpCode: "",
    },
  });
  if (!hasValidEmail) return <Redirect href="/login" />;
  const submit = form.handleSubmit((values) => {
    if (verify.isPending || resend.isPending) return;
    Keyboard.dismiss();
    verify.mutate(
      { email, otpCode: values.otpCode },
      {
        onSuccess: () =>
          router.replace({
            pathname: "/login",
            params: { email, result: "verified" },
          }),
      },
    );
  });
  return (
    <AuthLayout
      title="Xác minh email"
      subtitle="Nhập mã 6 chữ số được gửi đến email của bạn."
    >
      <View style={authStyles.fields}>
        <AuthFormInput
          control={form.control}
          name="email"
          label="Email"
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
              editable={!verify.isPending && !resend.isPending}
              onChangeText={(value) => {
                field.onChange(value);
                verify.reset();
              }}
              onSubmitEditing={submit}
            />
          )}
        />
        <Button
          size="lg"
          onPress={submit}
          disabled={verify.isPending || resend.isPending}
        >
          {verify.isPending ? "Đang xác minh..." : "Xác minh email"}
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            if (resend.isPending || verify.isPending || !cooldown.reserve())
              return;
            resend.mutate(email, {
              onSuccess: () => {
                form.resetField("otpCode");
                verify.reset();
              },
            });
          }}
          disabled={
            cooldown.seconds > 0 || resend.isPending || verify.isPending
          }
        >
          {resend.isPending
            ? "Đang gửi..."
            : cooldown.seconds > 0
              ? `Gửi lại mã sau ${cooldown.seconds}s`
              : "Gửi lại mã"}
        </Button>
        <View>
          <Pressable
            accessibilityRole="link"
            accessibilityState={{
              disabled: verify.isPending || resend.isPending,
            }}
            disabled={verify.isPending || resend.isPending}
            style={({ pressed }) => [
              styles.backLink,
              (pressed || verify.isPending || resend.isPending) && {
                opacity: 0.6,
              },
            ]}
            onPress={() =>
              router.replace({ pathname: "/register", params: { email } })
            }
          >
            <Text style={authStyles.link}>Quay lại đăng ký</Text>
          </Pressable>
          <Text style={[authStyles.footer, styles.footer]}>
            Đã có tài khoản?{" "}
            <Text
              accessibilityRole="link"
              style={authStyles.link}
              onPress={() => router.replace("/login")}
            >
              Đăng nhập
            </Text>
          </Text>
        </View>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footer: { paddingTop: 0 },
  backLink: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
  },
});
