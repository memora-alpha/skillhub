import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  resetPasswordSchema,
} from "../src/features/auth/schemas/auth-schemas";
import { profileEditSchema } from "../src/features/account/schemas/profile-schema";

const registration = {
  fullName: "Lan Anh",
  email: "user@example.com",
  password: "Password1!",
  confirmPassword: "Password1!",
  agreeTerms: true,
};

const cases: {
  label: string;
  schema: z.ZodType;
  input: unknown;
  field: string;
  message: string;
}[] = [
  {
    label: "empty email",
    schema: loginSchema,
    input: { email: "", password: "test", rememberMe: false },
    field: "email",
    message: "Vui lòng nhập email.",
  },
  {
    label: "malformed email",
    schema: loginSchema,
    input: { email: "bad", password: "test", rememberMe: false },
    field: "email",
    message: "Email chưa đúng định dạng.",
  },
  {
    label: "empty name",
    schema: registerSchema,
    input: { ...registration, fullName: " " },
    field: "fullName",
    message: "Vui lòng nhập tên của bạn.",
  },
  {
    label: "short name",
    schema: registerSchema,
    input: { ...registration, fullName: "A" },
    field: "fullName",
    message: "Tên cần ít nhất 2 ký tự.",
  },
  {
    label: "long name",
    schema: registerSchema,
    input: { ...registration, fullName: "A".repeat(101) },
    field: "fullName",
    message: "Tên chỉ được tối đa 100 ký tự.",
  },
  {
    label: "name with unsupported symbols",
    schema: registerSchema,
    input: { ...registration, fullName: "Lan@Anh" },
    field: "fullName",
    message: "Tên chỉ gồm chữ, khoảng trắng, dấu nháy hoặc gạch nối.",
  },
  {
    label: "empty password",
    schema: registerSchema,
    input: { ...registration, password: "" },
    field: "password",
    message: "Vui lòng nhập mật khẩu.",
  },
  {
    label: "short password",
    schema: registerSchema,
    input: { ...registration, password: "Aa1!" },
    field: "password",
    message: "Mật khẩu cần ít nhất 8 ký tự.",
  },
  {
    label: "missing uppercase",
    schema: registerSchema,
    input: { ...registration, password: "password1!" },
    field: "password",
    message: "Thêm ít nhất một chữ hoa (A–Z).",
  },
  {
    label: "missing lowercase",
    schema: registerSchema,
    input: { ...registration, password: "PASSWORD1!" },
    field: "password",
    message: "Thêm ít nhất một chữ thường (a–z).",
  },
  {
    label: "missing digit",
    schema: registerSchema,
    input: { ...registration, password: "Password!!" },
    field: "password",
    message: "Thêm ít nhất một chữ số (0–9).",
  },
  {
    label: "missing special character",
    schema: registerSchema,
    input: { ...registration, password: "Password12" },
    field: "password",
    message: "Thêm ký tự đặc biệt, ví dụ: @, #, !.",
  },
  {
    label: "empty confirmation",
    schema: registerSchema,
    input: { ...registration, confirmPassword: "" },
    field: "confirmPassword",
    message: "Vui lòng nhập lại mật khẩu.",
  },
  {
    label: "mismatched confirmation",
    schema: registerSchema,
    input: { ...registration, confirmPassword: "Different1!" },
    field: "confirmPassword",
    message: "Mật khẩu nhập lại chưa khớp.",
  },
  {
    label: "missing terms agreement",
    schema: registerSchema,
    input: { ...registration, agreeTerms: false },
    field: "agreeTerms",
    message: "Vui lòng đồng ý điều khoản và chính sách bảo mật.",
  },
  {
    label: "empty OTP",
    schema: verifyEmailSchema,
    input: { email: registration.email, otpCode: "" },
    field: "otpCode",
    message: "Vui lòng nhập mã xác minh.",
  },
  {
    label: "incomplete OTP",
    schema: verifyEmailSchema,
    input: { email: registration.email, otpCode: "12345" },
    field: "otpCode",
    message: "Mã xác minh phải có 6 chữ số.",
  },
  {
    label: "long headline",
    schema: profileEditSchema,
    input: {
      fullName: registration.fullName,
      headline: "A".repeat(121),
      bio: "",
    },
    field: "headline",
    message: "Vai trò / tiêu đề chỉ được tối đa 120 ký tự.",
  },
  {
    label: "long bio",
    schema: profileEditSchema,
    input: {
      fullName: registration.fullName,
      headline: "",
      bio: "A".repeat(1001),
    },
    field: "bio",
    message: "Giới thiệu chỉ được tối đa 1.000 ký tự.",
  },
];

for (const item of cases) {
  test(`gives actionable validation for ${item.label}`, () => {
    const result = item.schema.safeParse(item.input);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(
        result.error.issues.find((issue) => issue.path[0] === item.field)
          ?.message,
        item.message,
      );
    }
  });
}

test("copy changes preserve valid registration and reset contracts", () => {
  assert.equal(registerSchema.safeParse(registration).success, true);
  assert.equal(
    registerSchema.safeParse({ ...registration, fullName: "Nguyễn O'Anh-Trần" })
      .success,
    true,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      email: registration.email,
      otpCode: "123456",
      newPassword: registration.password,
      confirmNewPassword: registration.password,
    }).success,
    true,
  );
  assert.equal(
    profileEditSchema.safeParse({
      fullName: registration.fullName,
      headline: "",
      bio: "",
    }).success,
    true,
  );
  const password = "Aa1!" + "a".repeat(60);
  assert.equal(
    registerSchema.safeParse({
      ...registration,
      password,
      confirmPassword: password,
      fullName: "A".repeat(100),
    }).success,
    true,
  );
  assert.equal(
    registerSchema.safeParse({
      ...registration,
      password: password + "a",
      confirmPassword: password + "a",
    }).success,
    false,
  );
});
