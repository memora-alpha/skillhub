import { useRef, useState } from "react";
import { Keyboard, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Input } from "@/components/Input";
import { InfoModal } from "@/components/InfoModal";
import { AuthLayout } from "../components/AuthLayout";
import {
  AuthDivider,
  GoogleButton,
  PasswordRequirements,
  authStyles,
} from "../components/AuthControls";
import { useMockSession } from "../context/MockSession";
import { demoProfile } from "../mocks/auth";
import {
  validateRegistration,
  type RegistrationErrors,
  type RegistrationForm,
} from "../utils/validateRegistration";

export function RegisterScreen() {
  const router = useRouter();
  const { enterDemo } = useMockSession();
  const [form, setForm] = useState<RegistrationForm>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [notice, setNotice] = useState<
    "success" | "google" | "terms" | "privacy" | null
  >(null);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const confirmInput = useRef<TextInput>(null);
  const update = (key: keyof RegistrationForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      ...(key === "password" ? { confirmPassword: undefined } : {}),
    }));
  };
  const submit = () => {
    const next = validateRegistration(form, terms);
    setErrors(next);
    if (Object.keys(next).length) return;
    Keyboard.dismiss();
    setNotice("success");
  };
  const enter = () => {
    enterDemo({
      ...(notice === "google"
        ? demoProfile
        : { name: form.name.trim(), email: form.email.trim().toLowerCase() }),
      isNew: true,
    });
    setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
    router.replace("/home");
  };
  const noticeTitle =
    notice === "success"
      ? "Đăng ký giả lập thành công"
      : notice === "google"
        ? "Đăng ký với Google — bản demo"
        : notice === "terms"
          ? "Điều khoản sử dụng"
          : notice === "privacy"
            ? "Chính sách bảo mật"
            : null;
  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Bắt đầu hành trình học và chia sẻ kỹ năng."
    >
      <View style={authStyles.fields}>
        <GoogleButton
          label="Đăng ký với Google"
          onPress={() => setNotice("google")}
        />
        <AuthDivider label="hoặc điền thông tin" />
        <Input
          label="Họ và tên"
          required
          placeholder="Nguyễn Văn A"
          value={form.name}
          onChangeText={(value) => update("name", value)}
          error={errors.name}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailInput.current?.focus()}
        />
        <Input
          ref={emailInput}
          label="Email"
          required
          placeholder="email@gmail.com"
          value={form.email}
          onChangeText={(value) => update("email", value)}
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
          placeholder="8–64 ký tự"
          value={form.password}
          onChangeText={(value) => update("password", value)}
          error={errors.password}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmInput.current?.focus()}
        />
        {!!form.password && <PasswordRequirements password={form.password} />}
        <Input
          ref={confirmInput}
          label="Xác nhận mật khẩu"
          required
          password
          placeholder="Nhập lại mật khẩu"
          value={form.confirmPassword}
          onChangeText={(value) => update("confirmPassword", value)}
          error={errors.confirmPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Checkbox
          checked={terms}
          onChange={(value) => {
            setTerms(value);
            setErrors((current) => ({ ...current, terms: undefined }));
          }}
          label="Đồng ý điều khoản sử dụng và chính sách bảo mật"
          error={errors.terms}
        >
          Tôi đồng ý với{" "}
          <Text
            accessibilityRole="link"
            style={authStyles.link}
            onPress={() => setNotice("terms")}
          >
            Điều{"\u00a0"}khoản{"\u00a0"}sử{"\u00a0"}dụng
          </Text>{" "}
          và{" "}
          <Text
            accessibilityRole="link"
            style={authStyles.link}
            onPress={() => setNotice("privacy")}
          >
            Chính{"\u00a0"}sách{"\u00a0"}bảo{"\u00a0"}mật
          </Text>
          .
        </Checkbox>
        <Button size="lg" onPress={submit}>
          Tạo tài khoản
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
      <InfoModal
        title={noticeTitle}
        onClose={() => setNotice(null)}
        confirmLabel={
          notice === "success" || notice === "google"
            ? "Vào trang chủ demo"
            : "Đã hiểu"
        }
        onConfirm={
          notice === "success" || notice === "google" ? enter : undefined
        }
      >
        {notice === "success"
          ? "Thông tin đã hợp lệ. Bạn sẽ xem trang chủ dành cho người mới; tài khoản chưa được tạo trên hệ thống và chưa có xác minh email."
          : notice === "google"
            ? "Tiếp tục bằng hồ sơ mẫu Nguyễn Lan Anh. Bản demo không kết nối tài khoản Google."
            : "Nội dung chính thức sẽ được bổ sung sau. Bản demo chỉ dùng thông tin trong phiên hiện tại và không gửi dữ liệu lên máy chủ."}
      </InfoModal>
    </AuthLayout>
  );
}
