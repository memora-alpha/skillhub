export function passwordRequirements(password: string) {
  return [
    { label: "8–64 ký tự", met: password.length >= 8 && password.length <= 64 },
    { label: "Chữ hoa (A–Z)", met: /[A-Z]/.test(password) },
    { label: "Chữ thường (a–z)", met: /[a-z]/.test(password) },
    { label: "Chữ số (0–9)", met: /\d/.test(password) },
    { label: "Ký tự đặc biệt", met: /[^A-Za-z0-9\s]/.test(password) },
  ];
}
export function strongPassword(password: string) {
  return passwordRequirements(password).every((rule) => rule.met);
}
