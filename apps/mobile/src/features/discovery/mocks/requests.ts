export const requestFilters = ["Tất cả", "Lập trình", "Ngoại ngữ"] as const;
export type RequestCategory = (typeof requestFilters)[number];
export type LearningRequest = {
  id: string;
  title: string;
  user: string;
  userId: string;
  budget: string;
  tags: string[];
  sessions: number;
  created: string;
  category: Exclude<RequestCategory, "Tất cả">;
};
// Sample requests from the Figma Make export. No remote data source.
export const learningRequests: LearningRequest[] = [
  {
    id: "react",
    title: "Muốn học React từ cơ bản đến nâng cao",
    user: "Lê Hồng Anh",
    userId: "demo-hong-anh",
    budget: "50 CR/lộ trình",
    tags: ["React", "Frontend"],
    sessions: 6,
    created: "2 giờ trước",
    category: "Lập trình",
  },
  {
    id: "ielts",
    title: "Cần người hướng dẫn IELTS từ 6.0 lên 7.0",
    user: "Vũ Thị Mai",
    userId: "demo-thi-mai",
    budget: "70 CR/lộ trình",
    tags: ["IELTS", "Tiếng Anh"],
    sessions: 8,
    created: "5 giờ trước",
    category: "Ngoại ngữ",
  },
  {
    id: "python",
    title: "Học Python để làm Data Science, cần mentor thực chiến",
    user: "Đỗ Quang Huy",
    userId: "demo-quang-huy",
    budget: "60 CR/lộ trình",
    tags: ["Python", "Data Science"],
    sessions: 6,
    created: "1 ngày trước",
    category: "Lập trình",
  },
  {
    id: "japanese",
    title: "Học tiếng Nhật từ N5 lên N3, cần người luyện hội thoại",
    user: "Nguyễn Thị Thu",
    userId: "demo-thi-thu",
    budget: "65 CR/lộ trình",
    tags: ["Tiếng Nhật", "JLPT"],
    sessions: 8,
    created: "2 ngày trước",
    category: "Ngoại ngữ",
  },
];
