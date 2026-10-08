import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { errorMessage } from "@/lib/http/errors";
import { AuthLayout } from "../components/AuthLayout";
import { authStyles } from "../components/AuthControls";
import { useAuthActions } from "../hooks/use-auth-actions";
import { isEmail } from "../utils/validateRegistration";

export function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; sent?: string }>();
  const { verify, resend } = useAuthActions();
  const [email, setEmail] = useState(
    typeof params.email === "string" ? params.email : "",
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    if (verify.isPending) return;
    if (!isEmail(email)) return setError("Vui lòng nhập email hợp lệ.");
    if (!/^\d{6}$/.test(code))
      return setError("Mã xác minh gồm đúng 6 chữ số.");
    setError("");
    verify.mutate(
      { email: email.trim().toLowerCase(), otpCode: code },
      {
        onSuccess: () =>
          router.replace({
            pathname: "/login",
            params: { email: email.trim().toLowerCase(), result: "verified" },
          }),
      },
    );
  };
  return (
    <AuthLayout
      title="Xác minh email"
      subtitle="Nhập mã 6 chữ số được gửi đến email của bạn."
    >
      <View style={authStyles.fields}>
        {params.sent === "true" && (
          <FormNotice tone="success">
            Nếu địa chỉ đủ điều kiện, mã xác minh đã được gửi.
          </FormNotice>
        )}
        {(error || verify.isError) && (
          <FormNotice tone="error">
            {error || errorMessage(verify.error)}
          </FormNotice>
        )}
        {resend.isSuccess && (
          <FormNotice tone="success">
            Nếu địa chỉ đủ điều kiện, mã mới đã được gửi.
          </FormNotice>
        )}
        {resend.isError && (
          <FormNotice tone="error">{errorMessage(resend.error)}</FormNotice>
        )}
        <Input
          label="Email"
          required
          value={email}
          editable={!verify.isPending && !resend.isPending}
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
          editable={!verify.isPending}
          placeholder="123456"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, ""));
            setError("");
          }}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button size="lg" onPress={submit} disabled={verify.isPending}>
          {verify.isPending ? "Đang xác minh..." : "Xác minh email"}
        </Button>
        <Button
          variant="secondary"
          onPress={() => resend.mutate(email.trim().toLowerCase())}
          disabled={resend.isPending || verify.isPending}
        >
          {resend.isPending ? "Đang gửi..." : "Gửi lại mã"}
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
