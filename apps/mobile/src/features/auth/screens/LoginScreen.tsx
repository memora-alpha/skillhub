import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { AppError } from "@/lib/http/errors";
import { formValidationOptions } from "@/utils/form-validation";
import { useAuthFeedback } from "../hooks/use-auth-feedback";
import { AuthLayout } from "../components/AuthLayout";
import { authStyles } from "../components/AuthControls";
import { AuthFormInput } from "../components/AuthFormInput";
import { useAuthActions } from "../hooks/use-auth-actions";
import { loginSchema, type LoginFormValues } from "../schemas/auth-schemas";

export function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; result?: string }>();
  const { login } = useAuthActions();
  useAuthFeedback(
    params.result === "verified"
      ? "Email đã được xác minh. Bạn có thể đăng nhập."
      : params.result === "reset"
        ? "Mật khẩu đã được đổi. Đăng nhập bằng mật khẩu mới."
        : null,
  );
  const form = useForm<LoginFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: typeof params.email === "string" ? params.email : "",
      password: "",
      rememberMe: false,
    },
  });
  const submit = form.handleSubmit((values) => {
    if (login.isPending) return;
    Keyboard.dismiss();
    login.mutate(
      { ...values, email: values.email.toLowerCase() },
      {
        onSuccess: () => form.reset({ ...values, password: "" }),
      },
    );
  });
  return (
    <AuthLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục hành trình của bạn."
    >
      <View style={authStyles.fields}>
        <AuthFormInput
          control={form.control}
          name="email"
          label="Email"
          required
          placeholder="email@gmail.com"
          editable={!login.isPending}
          onChangeText={login.reset}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => form.setFocus("password")}
        />
        <AuthFormInput
          control={form.control}
          name="password"
          label="Mật khẩu"
          required
          password
          placeholder="Mật khẩu của bạn"
          editable={!login.isPending}
          onChangeText={login.reset}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => submit()}
        />
        <View style={styles.options}>
          <Controller
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onChange={(value) => {
                  if (!login.isPending) field.onChange(value);
                }}
                label="Ghi nhớ đăng nhập"
              >
                Ghi nhớ đăng nhập
              </Checkbox>
            )}
          />
          <Pressable
            accessibilityRole="button"
            disabled={login.isPending}
            onPress={() => router.push("/forgot-password")}
          >
            <Text style={authStyles.link}>Quên mật khẩu?</Text>
          </Pressable>
        </View>
        <Button size="lg" onPress={submit} disabled={login.isPending}>
          {login.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
        {login.error instanceof AppError &&
          login.error.code === "ACCOUNT_NOT_ACTIVE" && (
            <Button
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/verify-email",
                  params: {
                    email: form.getValues("email").trim().toLowerCase(),
                  },
                })
              }
            >
              Xác minh email
            </Button>
          )}
        <Text style={authStyles.footer}>
          Chưa có tài khoản?{" "}
          <Text
            accessibilityRole="link"
            style={authStyles.link}
            onPress={() => {
              if (!login.isPending) router.replace("/register");
            }}
          >
            Đăng ký
          </Text>
        </Text>
      </View>
    </AuthLayout>
  );
}
const styles = StyleSheet.create({
  options: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
});
