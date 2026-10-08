import { z } from "zod";
import { fullNameSchema } from "@/utils/identity-validation";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập email.")
  .min(5, "Email chưa đúng định dạng.")
  .max(254, "Email chỉ được tối đa 254 ký tự.")
  .email("Email chưa đúng định dạng.");

const passwordSchema = z
  .string()
  .min(1, "Vui lòng nhập mật khẩu.")
  .min(8, "Mật khẩu cần ít nhất 8 ký tự.")
  .max(64, "Mật khẩu chỉ được tối đa 64 ký tự.")
  .regex(/[A-Z]/, "Thêm ít nhất một chữ hoa (A–Z).")
  .regex(/[a-z]/, "Thêm ít nhất một chữ thường (a–z).")
  .regex(/[0-9]/, "Thêm ít nhất một chữ số (0–9).")
  .regex(/[^A-Za-z0-9\s]/, "Thêm ký tự đặc biệt, ví dụ: @, #, !.");

export { fullNameSchema } from "@/utils/identity-validation";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
  rememberMe: z.boolean(),
});

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu."),
    agreeTerms: z.boolean().refine((value) => value, {
      message: "Vui lòng đồng ý điều khoản và chính sách bảo mật.",
    }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại chưa khớp.",
  });

export const verifyEmailSchema = z.object({
  email: emailSchema,
  otpCode: z
    .string()
    .min(1, "Vui lòng nhập mã xác minh.")
    .regex(/^\d{6}$/, "Mã xác minh phải có 6 chữ số."),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const recoveryCodeSchema = verifyEmailSchema.pick({ otpCode: true });

const newPasswordFields = {
  newPassword: passwordSchema,
  confirmNewPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu."),
};

export const newPasswordSchema = z
  .object(newPasswordFields)
  .refine((value) => value.newPassword === value.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Mật khẩu nhập lại chưa khớp.",
  });

export const resetPasswordSchema = verifyEmailSchema
  .extend(newPasswordFields)
  .refine((value) => value.newPassword === value.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Mật khẩu nhập lại chưa khớp.",
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type RecoveryCodeFormValues = z.infer<typeof recoveryCodeSchema>;
export type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;
