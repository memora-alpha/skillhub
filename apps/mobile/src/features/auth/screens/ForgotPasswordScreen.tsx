import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { errorMessage } from "@/lib/http/errors";
import { AuthLayout } from "../components/AuthLayout";
import { authStyles } from "../components/AuthControls";
import { useAuthActions } from "../hooks/use-auth-actions";
import { isEmail } from "../utils/validateRegistration";

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgot } = useAuthActions();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    if (forgot.isPending) return;
    if (!isEmail(email)) return setError("Vui lòng nhập email hợp lệ.");
    setError("");
    forgot.mutate(email.trim().toLowerCase(), {
      onSuccess: () =>
        router.replace({
          pathname: "/reset-password",
          params: { email: email.trim().toLowerCase(), sent: "true" },
        }),
    });
  };
  return (
    <AuthLayout
      title="Quên mật khẩu"
      subtitle="Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu nếu địa chỉ đủ điều kiện."
    >
      <View style={authStyles.fields}>
        {(error || forgot.isError) && (
          <FormNotice tone="error">
            {error || errorMessage(forgot.error)}
          </FormNotice>
        )}
        <Input
          label="Email"
          required
          value={email}
          editable={!forgot.isPending}
          placeholder="email@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          onChangeText={(value) => {
            setEmail(value);
            setError("");
          }}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button size="lg" onPress={submit} disabled={forgot.isPending}>
          {forgot.isPending ? "Đang gửi..." : "Gửi hướng dẫn"}
        </Button>
        <Text style={authStyles.footer}>
          Nhớ mật khẩu rồi?{" "}
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
