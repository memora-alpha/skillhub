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
  const name = value.trim();
  if (!name) return "Vui lòng nhập họ và tên.";
  if (
    [...name].length < 2 ||
    [...name].length > 100 ||
    !/\p{L}/u.test(name) ||
    !/^[\p{L}\p{M} '\u2019-]+$/u.test(name)
  )
    return "Tên cần từ 2 đến 100 ký tự, chỉ gồm chữ, khoảng trắng, dấu nháy hoặc gạch nối.";
  return undefined;
}

export function passwordRequirements(password: string) {
  return [
    {
      label: "Từ 8 đến 64 ký tự",
      met: password.length >= 8 && password.length <= 64,
    },
    { label: "Có ít nhất một chữ hoa", met: /[A-Z]/.test(password) },
    { label: "Có ít nhất một chữ thường", met: /[a-z]/.test(password) },
    { label: "Có ít nhất một chữ số", met: /[0-9]/.test(password) },
    {
      label: "Có ít nhất một ký tự đặc biệt",
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
    errors.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
  if (!terms)
    errors.terms =
      "Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật để tiếp tục.";
  return errors;
}
