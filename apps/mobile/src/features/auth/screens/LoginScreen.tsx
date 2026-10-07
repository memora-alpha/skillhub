import { useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { InfoModal } from "@/components/InfoModal";
import { AuthLayout } from "../components/AuthLayout";
import {
  AuthDivider,
  GoogleButton,
  authStyles,
} from "../components/AuthControls";
import { useMockSession } from "../context/MockSession";
import { demoProfile, newUserEmail } from "../mocks/auth";
import { isEmail } from "../utils/validateRegistration";

type LoginNotice = "google" | "forgot";
const loginNoticeCopy: Record<
  LoginNotice,
  Readonly<{ title: string; confirmLabel: string; body: string }>
> = {
  google: {
    title: "Đăng nhập với Google — bản demo",
    confirmLabel: "Tiếp tục bản demo",
    body: "Mở trang chủ bằng hồ sơ mẫu Nguyễn Lan Anh. Bản demo không kết nối tài khoản Google.",
  },
  forgot: {
    title: "Quên mật khẩu?",
    confirmLabel: "Đã hiểu",
    body: "Khôi phục mật khẩu sẽ được bổ sung khi kết nối backend. Hiện tại bạn có thể dùng email hợp lệ và mật khẩu bất kỳ để xem trang chủ demo.",
  },
};

export function LoginScreen() {
  const router = useRouter();
  const { enterDemo } = useMockSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [notice, setNotice] = useState<LoginNotice | null>(null);
  const passwordInput = useRef<TextInput>(null);
  const enter = (google = false) => {
    Keyboard.dismiss();
    enterDemo({
      ...demoProfile,
      email: google ? demoProfile.email : email.trim().toLowerCase(),
      isNew: !google && email.trim().toLowerCase() === newUserEmail,
    });
    router.replace("/home");
  };
  const submit = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Vui lòng nhập email.";
    else if (!isEmail(email)) next.email = "Email chưa đúng định dạng.";
    if (!password) next.password = "Vui lòng nhập mật khẩu.";
    setErrors(next);
    if (Object.keys(next).length) return;
    enter();
  };
  const noticeCopy = notice ? loginNoticeCopy[notice] : null;
  const confirmNotice = notice === "google" ? () => enter(true) : undefined;
  return (
    <AuthLayout
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục hành trình của bạn."
    >
      <View style={authStyles.fields}>
        <GoogleButton
          label="Đăng nhập với Google"
          onPress={() => setNotice("google")}
        />
        <AuthDivider label="hoặc đăng nhập bằng email" />
        {Object.keys(errors).length > 0 && (
          <FormNotice tone="error">
            Kiểm tra lại các trường được đánh dấu.
          </FormNotice>
        )}
        <Input
          label="Email"
          required
          placeholder="email@gmail.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          error={errors.email}
          keyboardType="email-address"
          autoFocus
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
          onChangeText={(value) => {
            setPassword(value);
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
            onChange={setRemember}
            label="Ghi nhớ đăng nhập"
          >
            Ghi nhớ đăng nhập
          </Checkbox>
          <Pressable
            accessibilityRole="button"
            onPress={() => setNotice("forgot")}
          >
            <Text style={authStyles.link}>Quên mật khẩu?</Text>
          </Pressable>
        </View>
        <Button size="lg" onPress={submit}>
          Đăng nhập
        </Button>
        <Text style={authStyles.footer}>
          Chưa có tài khoản?{" "}
          <Text
            accessibilityRole="link"
            style={authStyles.link}
            onPress={() => router.replace("/register")}
          >
            Đăng ký
          </Text>
        </Text>
        <Text style={authStyles.hint}>
          Thử: new@test.com (người mới) hoặc bất kỳ email khác
        </Text>
      </View>
      <InfoModal
        title={noticeCopy?.title ?? null}
        onClose={() => setNotice(null)}
        confirmLabel={noticeCopy?.confirmLabel ?? "Đã hiểu"}
        onConfirm={confirmNotice}
      >
        {noticeCopy?.body ?? ""}
      </InfoModal>
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
