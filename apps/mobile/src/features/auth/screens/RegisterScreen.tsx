import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Keyboard, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { InfoModal } from "@/components/InfoModal";
import { AuthLayout } from "../components/AuthLayout";
import { PasswordRequirements, authStyles } from "../components/AuthControls";
import { AuthFormInput } from "../components/AuthFormInput";
import { useAuthActions } from "../hooks/use-auth-actions";
import { formValidationOptions } from "@/utils/form-validation";
import {
  registerSchema,
  type RegisterFormValues,
} from "../schemas/auth-schemas";

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
  const form = useForm<RegisterFormValues>({
    ...formValidationOptions,
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreeTerms: false,
    },
  });
  const [notice, setNotice] = useState<RegisterNotice | null>(null);
  const password = form.watch("password");
  const submit = form.handleSubmit((values) => {
    if (register.isPending) return;
    Keyboard.dismiss();
    register.mutate(
      {
        fullName: values.fullName,
        email: values.email.toLowerCase(),
        password: values.password,
        confirmPassword: values.confirmPassword,
        agreeTerms: true,
        locale: "vi",
      },
      {
        onSuccess: () => {
          form.reset({ ...values, password: "", confirmPassword: "" });
          router.replace({
            pathname: "/verify-email",
            params: { email: values.email.toLowerCase(), sent: "true" },
          });
        },
      },
    );
  });
  const noticeCopy = notice ? registerNoticeCopy[notice] : null;
  return (
    <AuthLayout
      title="Tạo tài khoản"
      subtitle="Bắt đầu hành trình học và chia sẻ kỹ năng."
    >
      <View style={authStyles.fields}>
        <AuthFormInput
          control={form.control}
          name="fullName"
          label="Họ và tên"
          required
          placeholder="Nguyễn Văn A"
          editable={!register.isPending}
          onChangeText={register.reset}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => form.setFocus("email")}
        />
        <AuthFormInput
          control={form.control}
          name="email"
          label="Email"
          required
          placeholder="email@gmail.com"
          editable={!register.isPending}
          onChangeText={register.reset}
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
          placeholder="8–64 ký tự"
          editable={!register.isPending}
          onChangeText={() => {
            register.reset();
            if (form.getFieldState("confirmPassword").isTouched)
              void form.trigger("confirmPassword");
          }}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => form.setFocus("confirmPassword")}
        />
        <PasswordRequirements password={password} />
        <AuthFormInput
          control={form.control}
          name="confirmPassword"
          label="Xác nhận mật khẩu"
          required
          password
          placeholder="Nhập lại mật khẩu"
          editable={!register.isPending}
          onChangeText={register.reset}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Controller
          control={form.control}
          name="agreeTerms"
          render={({ field, fieldState }) => (
            <Checkbox
              checked={field.value}
              onChange={(value) => {
                if (register.isPending) return;
                field.onChange(value);
                field.onBlur();
              }}
              label="Đồng ý điều khoản sử dụng và chính sách bảo mật"
              error={fieldState.error?.message}
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
          )}
        />
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
