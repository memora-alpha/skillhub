import { useRef, useState } from "react";
import { Keyboard, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { FormNotice } from "@/components/FormNotice";
import { Input } from "@/components/Input";
import { InfoModal } from "@/components/InfoModal";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordRequirements, authStyles } from "../components/AuthControls";
import { useAuthActions } from "../hooks/use-auth-actions";
import { errorMessage } from "@/lib/http/errors";
import {
  validateRegistration,
  type RegistrationErrors,
  type RegistrationForm,
} from "../utils/validateRegistration";

type RegisterNotice = "terms" | "privacy";
const registerNoticeCopy: Record<
  RegisterNotice,
  Readonly<{ title: string; body: string }>
> = {
  terms: {
    title: "Điều khoản sử dụng",
    body: "Nội dung điều khoản chính thức chưa được cung cấp. Vui lòng liên hệ SkillHub để được hỗ trợ trước khi đăng ký.",
  },
  privacy: {
    title: "Chính sách bảo mật",
    body: "Nội dung chính sách chính thức chưa được cung cấp. Vui lòng liên hệ SkillHub để được hỗ trợ trước khi đăng ký.",
  },
};

export function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthActions();
  const [form, setForm] = useState<RegistrationForm>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [notice, setNotice] = useState<RegisterNotice | null>(null);
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const confirmInput = useRef<TextInput>(null);
  const update = (key: keyof RegistrationForm, value: string) => {
    register.reset();
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({
      ...current,
      [key]: undefined,
      ...(key === "password" ? { confirmPassword: undefined } : {}),
    }));
  };
  const submit = () => {
    if (register.isPending) return;
    const next = validateRegistration(form, terms);
    setErrors(next);
    if (Object.keys(next).length) return;
    Keyboard.dismiss();
    register.mutate(
      {
        fullName: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        agreeTerms: true,
        locale: "vi",
      },
      {
        onSuccess: () => {
          setForm((current) => ({
            ...current,
            password: "",
            confirmPassword: "",
          }));
          router.replace({
            pathname: "/verify-email",
            params: { email: form.email.trim().toLowerCase(), sent: "true" },
          });
        },
      },
    );
  };
  const noticeCopy = notice ? registerNoticeCopy[notice] : null;
  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Bắt đầu hành trình học và chia sẻ kỹ năng."
    >
      <View style={authStyles.fields}>
        {register.isError && (
          <FormNotice tone="error">{errorMessage(register.error)}</FormNotice>
        )}
        {Object.keys(errors).length > 0 && (
          <FormNotice tone="error">
            Kiểm tra lại các trường được đánh dấu.
          </FormNotice>
        )}
        <Input
          label="Họ và tên"
          required
          placeholder="Nguyễn Văn A"
          value={form.name}
          editable={!register.isPending}
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
          editable={!register.isPending}
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
          editable={!register.isPending}
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
          editable={!register.isPending}
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
            if (register.isPending) return;
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
        <Button size="lg" onPress={submit} disabled={register.isPending}>
          {register.isPending ? "Đang gửi..." : "Tạo tài khoản"}
        </Button>
        <Text style={authStyles.footer}>
          Đã có tài khoản?{" "}
          <Text
            accessibilityRole="link"
            style={authStyles.link}
            onPress={() => {
              if (!register.isPending) router.replace("/login");
            }}
          >
            Đăng nhập
          </Text>
        </Text>
      </View>
      <InfoModal
        title={noticeCopy?.title ?? null}
        onClose={() => setNotice(null)}
        confirmLabel="Đã hiểu"
      >
        {noticeCopy?.body ?? ""}
      </InfoModal>
    </AuthLayout>
  );
}
