export type RegistrationForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};
export type RegistrationErrors = Partial<
  Record<keyof RegistrationForm | "terms", string>
>;
export const isEmail = (value: string) =>
  value.trim().length >= 5 &&
  value.trim().length <= 254 &&
  /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value.trim());

export function validateName(value: string): string | undefined {
  const result = fullNameSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function passwordRequirements(password: string) {
  return [
    {
      label: "8–64 ký tự",
      met: password.length >= 8 && password.length <= 64,
    },
    { label: "Chữ hoa (A–Z)", met: /[A-Z]/.test(password) },
    { label: "Chữ thường (a–z)", met: /[a-z]/.test(password) },
    { label: "Chữ số (0–9)", met: /[0-9]/.test(password) },
    {
      label: "Ký tự đặc biệt",
      met: /[^A-Za-z0-9\s]/.test(password),
    },
  ];
}
export function validateRegistration(
  form: RegistrationForm,
  terms: boolean,
): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const nameError = validateName(form.name);
  if (nameError) errors.name = nameError;
  if (!form.email.trim()) errors.email = "Vui lòng nhập email.";
  else if (!isEmail(form.email)) errors.email = "Email chưa đúng định dạng.";
  if (!form.password) errors.password = "Vui lòng nhập mật khẩu.";
  else if (!passwordRequirements(form.password).every((rule) => rule.met))
    errors.password = "Mật khẩu chưa đáp ứng đầy đủ các yêu cầu bên dưới.";
  if (!form.confirmPassword)
    errors.confirmPassword = "Vui lòng nhập lại mật khẩu.";
  else if (form.confirmPassword !== form.password)
    errors.confirmPassword = "Mật khẩu nhập lại chưa khớp.";
  if (!terms)
    errors.terms = "Vui lòng đồng ý điều khoản và chính sách bảo mật.";
  return errors;
}
import { fullNameSchema } from "@/utils/identity-validation";
