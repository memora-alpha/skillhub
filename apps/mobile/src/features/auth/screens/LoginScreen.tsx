import { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { AppError, errorMessage } from "@/lib/http/errors";
import { AuthLayout } from "../components/AuthLayout";
import { authStyles } from "../components/AuthControls";
import { useAuthActions } from "../hooks/use-auth-actions";
import { isEmail } from "../utils/validateRegistration";

export function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; result?: string }>();
  const { login } = useAuthActions();
  const [email, setEmail] = useState(
    typeof params.email === "string" ? params.email : "",
  );
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const passwordInput = useRef<TextInput>(null);
  const submit = () => {
    if (login.isPending) return;
    const next: typeof errors = {};
    if (!isEmail(email)) next.email = "Vui lòng nhập email hợp lệ.";
    if (!password) next.password = "Vui lòng nhập mật khẩu.";
    setErrors(next);
    if (Object.keys(next).length) return;
    Keyboard.dismiss();
    login.mutate(
      { email: email.trim().toLowerCase(), password, rememberMe: remember },
      { onSuccess: () => setPassword("") },
    );
  };
  return (
    <AuthLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục hành trình của bạn."
    >
      <View style={authStyles.fields}>
        {params.result === "verified" && (
          <FormNotice tone="success">
            Email đã được xác minh. Bạn có thể đăng nhập.
          </FormNotice>
        )}
        {params.result === "reset" && (
          <FormNotice tone="success">
            Mật khẩu đã được đổi. Đăng nhập bằng mật khẩu mới.
          </FormNotice>
        )}
        {login.isError && (
          <FormNotice tone="error">{errorMessage(login.error)}</FormNotice>
        )}
        <Input
          label="Email"
          required
          placeholder="email@gmail.com"
          value={email}
          editable={!login.isPending}
          onChangeText={(value) => {
            setEmail(value);
            login.reset();
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordInput.current?.focus()}
        />
        <Input
          ref={passwordInput}
          label="Mật khẩu"
          required
          password
          placeholder="Mật khẩu của bạn"
          value={password}
          editable={!login.isPending}
          onChangeText={(value) => {
            setPassword(value);
            login.reset();
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          error={errors.password}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <View style={styles.options}>
          <Checkbox
            checked={remember}
            onChange={(value) => {
              if (!login.isPending) setRemember(value);
            }}
            label="Ghi nhớ đăng nhập"
          >
            Ghi nhớ đăng nhập
          </Checkbox>
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
                  params: { email: email.trim().toLowerCase() },
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
