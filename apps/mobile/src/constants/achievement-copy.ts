// Localize the original seeded English copy; custom server copy remains intact.
const titles: Readonly<Record<string, string>> = {
  "Verified Member": "Thành viên xác thực",
  "First Path": "Bước chân đầu tiên",
  "Path Builder": "Người xây hành trình",
  "Teaching Guide": "Người dẫn dắt",
  "Trusted Member": "Thành viên đáng tin cậy",
  Veteran: "Người đồng hành lâu năm",
  "Verified Skills": "Kỹ năng vững vàng",
};
const descriptions: Readonly<Record<string, string>> = {
  "Active account with verified email.":
    "Tài khoản đang hoạt động và email đã được xác minh.",
  "Complete one learning path.": "Hoàn thành lộ trình học đầu tiên.",
  "Complete five learning paths.": "Hoàn thành 5 lộ trình học tập.",
  "Teach ten completed learning paths.": "Dạy trong 10 lộ trình đã hoàn tất.",
  "Reach 70 reputation and complete five paths.":
    "Đạt 70 điểm uy tín và hoàn thành 5 lộ trình.",
  "Reach 180 days on the platform and complete ten paths.":
    "Đồng hành 180 ngày và hoàn thành 10 lộ trình.",
  "Have three verified skills.": "Có 3 kỹ năng đã được xác minh.",
};
export const achievementTitleLabel = (title: string) =>
  Object.hasOwn(titles, title) ? titles[title]! : title;
export const achievementDescriptionLabel = (description: string) =>
  Object.hasOwn(descriptions, description)
    ? descriptions[description]!
    : description;
