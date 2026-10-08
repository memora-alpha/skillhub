import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { OtpInput } from "@/components/OtpInput";
import { formValidationOptions } from "@/utils/form-validation";
import { useAuthFeedback } from "../hooks/use-auth-feedback";
import { AuthLayout } from "../components/AuthLayout";
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
    params.sent === "true" && hasValidEmail
      ? "Nếu địa chỉ đủ điều kiện, mã xác minh đã được gửi."
      : null,
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
        <Text style={authStyles.footer}>
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
    </AuthLayout>
  );
}
