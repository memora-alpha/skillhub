import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { formValidationOptions } from "@/utils/form-validation";
import { AuthLayout } from "../components/AuthLayout";
import { authStyles } from "../components/AuthControls";
import { AuthFormInput } from "../components/AuthFormInput";
import { useAuthActions } from "../hooks/use-auth-actions";
import { useVerificationCooldown } from "../hooks/use-verification-cooldown";
import { passwordRecoveryStore } from "../utils/password-recovery-flow";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "../schemas/auth-schemas";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgot } = useAuthActions();
  const form = useForm<ForgotPasswordFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const cooldown = useVerificationCooldown(
    form.watch("email"),
    false,
    "recovery",
  );
  const submit = form.handleSubmit((values) => {
    if (forgot.isPending || !cooldown.reserve()) return;
    Keyboard.dismiss();
    forgot.mutate(values.email.toLowerCase(), {
      onSuccess: () => {
        passwordRecoveryStore.getState().begin(values.email);
        router.replace({
          pathname: "/reset-password-code",
          params: { sent: "true" },
        });
      },
    });
  });
  return (
    <AuthLayout
      title="Quên mật khẩu"
      subtitle="Nhập email tài khoản để nhận mã khôi phục mật khẩu."
    >
      <View style={authStyles.fields}>
        <AuthFormInput
          control={form.control}
          name="email"
          label="Email"
          required
          editable={!forgot.isPending}
          placeholder="email@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          onChangeText={forgot.reset}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button
          size="lg"
          onPress={submit}
          disabled={forgot.isPending || cooldown.seconds > 0}
        >
          {forgot.isPending
            ? "Đang gửi..."
            : cooldown.seconds > 0
              ? `Gửi lại mã sau ${cooldown.seconds}s`
              : "Gửi mã xác minh"}
        </Button>
        <Text style={authStyles.footer}>
          Nhớ mật khẩu rồi?{" "}
          <Text
            accessibilityRole="link"
            style={authStyles.link}
            onPress={() => {
              if (!forgot.isPending) router.replace("/login");
            }}
          >
            Đăng nhập
          </Text>
        </Text>
      </View>
    </AuthLayout>
  );
}
