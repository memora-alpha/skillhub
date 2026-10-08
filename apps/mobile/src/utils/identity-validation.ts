import { z } from "zod";

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập tên của bạn.")
  .min(2, "Tên cần ít nhất 2 ký tự.")
  .max(100, "Tên chỉ được tối đa 100 ký tự.")
  .regex(/\p{L}/u, "Tên cần có ít nhất một chữ cái.")
  .regex(
    /^[\p{L}\p{M} '\u2019-]+$/u,
    "Tên chỉ gồm chữ, khoảng trắng, dấu nháy hoặc gạch nối.",
  );
