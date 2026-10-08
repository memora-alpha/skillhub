import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { errorMessage } from "@/lib/http/errors";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordRequirements, authStyles } from "../components/AuthControls";
import { useAuthActions } from "../hooks/use-auth-actions";
import { isEmail, passwordRequirements } from "../utils/validateRegistration";

export function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; sent?: string }>();
  const { reset } = useAuthActions();
  const [email, setEmail] = useState(
    typeof params.email === "string" ? params.email : "",
  );
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    if (reset.isPending) return;
    if (!isEmail(email)) return setError("Vui lòng nhập email hợp lệ.");
    if (!/^\d{6}$/.test(code))
      return setError("Mã xác minh gồm đúng 6 chữ số.");
    if (!passwordRequirements(password).every((item) => item.met))
      return setError("Mật khẩu chưa đáp ứng các yêu cầu.");
    if (password !== confirm) return setError("Mật khẩu xác nhận chưa khớp.");
    setError("");
    reset.mutate(
      {
        email: email.trim().toLowerCase(),
        otpCode: code,
        newPassword: password,
        confirmNewPassword: confirm,
      },
      {
        onSuccess: () =>
          router.replace({
            pathname: "/login",
            params: { email: email.trim().toLowerCase(), result: "reset" },
          }),
      },
    );
  };
  return (
    <AuthLayout
      title="Đặt lại mật khẩu"
      subtitle="Dùng mã trong email để tạo mật khẩu mới."
    >
      <View style={authStyles.fields}>
        {params.sent === "true" && (
          <FormNotice tone="success">
            Nếu địa chỉ đủ điều kiện, hướng dẫn đã được gửi.
          </FormNotice>
        )}
        {(error || reset.isError) && (
          <FormNotice tone="error">
            {error || errorMessage(reset.error)}
          </FormNotice>
        )}
        <Input
          label="Email"
          required
          value={email}
          editable={!reset.isPending}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          onChangeText={(value) => {
            setEmail(value);
            setError("");
          }}
        />
        <Input
          label="Mã xác minh"
          required
          value={code}
          editable={!reset.isPending}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, ""));
            setError("");
          }}
        />
        <Input
          label="Mật khẩu mới"
          required
          password
          value={password}
          editable={!reset.isPending}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={(value) => {
            setPassword(value);
            setError("");
          }}
        />
        <PasswordRequirements password={password} />
        <Input
          label="Xác nhận mật khẩu mới"
          required
          password
          value={confirm}
          editable={!reset.isPending}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          onChangeText={(value) => {
            setConfirm(value);
            setError("");
          }}
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
            onPress={() => router.replace("/login")}
          >
            đăng nhập
          </Text>
        </Text>
      </View>
    </AuthLayout>
  );
}
