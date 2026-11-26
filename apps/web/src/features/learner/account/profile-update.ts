import { validFullName } from "@/lib/profile-name";
type EditableProfile = {
  fullName: string;
  headline: string | null;
  bio: string | null;
  timezone?: string | null;
  locale: string;
};

/** An unchanged bio must be absent: its presence resets moderation on the API. */
export function profileUpdate(profile: EditableProfile, fields: FormData) {
  const previous = {
    fullName: profile.fullName,
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    timezone: profile.timezone ?? "Asia/Ho_Chi_Minh",
    locale: profile.locale,
  };
  const body: Partial<Record<keyof typeof previous, string>> = {};
  for (const key of Object.keys(previous) as (keyof typeof previous)[]) {
    const raw = fields.get(key);
    if (typeof raw === "string" && raw.trim() !== previous[key].trim())
      body[key] = raw.trim();
  }
  if (body.locale !== undefined && !["vi", "en"].includes(body.locale))
    throw new Error("Chọn ngôn ngữ tiếng Việt hoặc tiếng Anh.");
  if (body.fullName !== undefined && !validFullName(body.fullName))
    throw new Error(
      "Họ tên cần từ 2 đến 100 ký tự chữ, khoảng trắng, dấu nháy hoặc gạch nối.",
    );
  if (body.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("vi", { timeZone: body.timezone }).format();
    } catch {
      throw new Error("Chọn múi giờ IANA hợp lệ, ví dụ Asia/Ho_Chi_Minh.");
    }
  }
  return body;
}
