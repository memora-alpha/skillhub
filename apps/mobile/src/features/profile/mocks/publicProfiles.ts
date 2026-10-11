export type PublicProfile = {
  id: string;
  name: string;
  headline?: string;
  bio?: string;
  reputation?: number;
  rating?: string;
  stats?: { value: string; label: string }[];
  skills: { id: string; name: string; level: string; verified: boolean }[];
  reviews?: { name: string; text: string; stars: number }[];
};

// Public-only demo records. No contact details, private evidence or file URLs.
export const publicProfiles: PublicProfile[] = [
  {
    id: "demo-viet-anh",
    name: "Trần Việt Anh",
    headline: "Senior Frontend Developer",
    bio: "5 năm kinh nghiệm Frontend tại các startup. Chuyên React, TypeScript, Next.js. Mình thích dạy theo dự án thực tế hơn lý thuyết suông.",
    reputation: 85,
    rating: "4.97 (24 đánh giá)",
    stats: [
      { value: "87", label: "Buổi học" },
      { value: "23", label: "Học viên" },
      { value: "96%", label: "Hoàn thành" },
    ],
    skills: [
      {
        id: "react",
        name: "React & Next.js",
        level: "Chuyên gia",
        verified: true,
      },
      {
        id: "typescript",
        name: "TypeScript",
        level: "Nâng cao",
        verified: true,
      },
      { id: "nodejs", name: "Node.js", level: "Nâng cao", verified: false },
    ],
    reviews: [
      {
        name: "Nguyễn Bảo Long",
        text: "Anh Việt Anh dạy rất thực tế, sau khóa học mình có thể tự xây dựng ứng dụng React!",
        stars: 5,
      },
      {
        name: "Phạm Thị Hoa",
        text: "Giải thích rõ ràng, kiên nhẫn với người mới. Rất recommend!",
        stars: 5,
      },
    ],
  },
  {
    id: "demo-hong-anh",
    name: "Lê Hồng Anh",
    reputation: 85,
    bio: "Đang luyện thi IELTS, có thể hỗ trợ luyện Speaking & Writing Band 6.0+. Muốn học React để tự xây dựng một ứng dụng web hoàn chỉnh.",
    skills: [
      {
        id: "ielts",
        name: "Tiếng Anh / IELTS",
        level: "Trung cấp",
        verified: false,
      },
      {
        id: "javascript",
        name: "JavaScript cơ bản",
        level: "Cơ bản",
        verified: false,
      },
    ],
  },
  { id: "demo-thi-mai", name: "Vũ Thị Mai", skills: [] },
  { id: "demo-quang-huy", name: "Đỗ Quang Huy", skills: [] },
  { id: "demo-thi-thu", name: "Nguyễn Thị Thu", skills: [] },
  { id: "demo-minh-ha", name: "Nguyễn Minh Hà", skills: [] },
  { id: "demo-minh-khang", name: "Nguyễn Minh Khang", skills: [] },
  { id: "demo-thu-ha", name: "Phạm Thu Hà", skills: [] },
];
