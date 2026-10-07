export type RequestDetailContent = {
  hashtags: string[];
  duration: string;
  learning: string;
  learningTags: string[];
  sharing: string;
  sharingTags: string[];
  schedule: { day: string; slots: string[] }[];
  scheduleNote: string;
  reputation: number;
  memberSince: string;
};
// The export supplies a complete detail frame only for the React request.
// Other list items retain their own identity and display missing-content placeholders.
export const requestDetails: Record<string, RequestDetailContent | undefined> =
  {
    react: {
      hashtags: [
        "#React",
        "#Frontend",
        "#JavaScript",
        "#Hooks",
        "#StateManagement",
      ],
      duration: "60–90 phút/buổi",
      learning:
        "React từ cơ bản đến nâng cao — hiểu rõ hooks (useState, useEffect, useContext), state management với Redux Toolkit, và cách tổ chức project thực tế. Mục tiêu cuối là tự xây được một ứng dụng web hoàn chỉnh.",
      learningTags: [
        "React Hooks",
        "Redux",
        "Component Design",
        "API Integration",
      ],
      sharing:
        "Tiếng Anh IELTS — mình đang học luyện thi, có thể hỗ trợ luyện Speaking & Writing Band 6.0+. Hoặc JavaScript cơ bản nếu người dạy React chưa quen JS.",
      sharingTags: [
        "Tiếng Anh IELTS",
        "IELTS Speaking",
        "IELTS Writing",
        "JavaScript cơ bản",
      ],
      schedule: [
        { day: "Thứ 5", slots: ["19:00 – 21:00"] },
        { day: "Thứ 7", slots: ["08:00 – 10:00", "19:00 – 21:00"] },
        { day: "Chủ nhật", slots: ["08:00 – 11:00"] },
      ],
      scheduleNote:
        "Ưu tiên học online qua video call · Có thể điều chỉnh lịch nếu cần",
      reputation: 85,
      memberSince: "Thành viên 3 tháng",
    },
  };
