import { z } from "zod";
import { fullNameSchema } from "@/utils/identity-validation";

export const profileEditSchema = z.object({
  fullName: fullNameSchema,
  headline: z
    .string()
    .trim()
    .max(120, "Vai trò / tiêu đề chỉ được tối đa 120 ký tự."),
  bio: z.string().trim().max(1000, "Giới thiệu chỉ được tối đa 1.000 ký tự."),
});

export type ProfileEditFormValues = z.infer<typeof profileEditSchema>;
