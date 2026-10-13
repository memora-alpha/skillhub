import { Text, View } from "react-native";
import { levelLabels, type SkillLevel } from "../types/skills";
import { formStyles } from "./skill-form-styles";
import { skillStyles } from "./SkillsLayout";

const guidance: Record<
  SkillLevel,
  { summary: string; language: string; programming: string }
> = {
  BEGINNER: {
    summary:
      "Nắm kiến thức nền tảng và làm được việc đơn giản, có thể cần hướng dẫn.",
    language:
      "Biết chào hỏi, giới thiệu bản thân, từ vựng và mẫu câu quen thuộc; hiểu câu ngắn khi nghe chậm và đọc đoạn đơn giản.",
    programming:
      "Biết biến, kiểu dữ liệu, điều kiện, vòng lặp và hàm; viết, chạy và sửa lỗi một chương trình đơn giản.",
  },
  INTERMEDIATE: {
    summary:
      "Tự thực hiện được các công việc quen thuộc và xử lý vấn đề thường gặp.",
    language:
      "Giao tiếp về sinh hoạt, học tập hoặc công việc quen thuộc; đọc nội dung phổ thông và viết đoạn văn trình bày ý kiến.",
    programming:
      "Tự xây dựng ứng dụng nhỏ, thao tác dữ liệu và gọi API; biết chia mã thành các phần, dùng Git và tìm lỗi thông thường.",
  },
  ADVANCED: {
    summary:
      "Làm việc độc lập với nhiệm vụ phức tạp và giải thích được cách giải quyết.",
    language:
      "Thảo luận chủ đề phức tạp, đọc tài liệu chuyên môn và viết nội dung có lập luận; diễn đạt linh hoạt trong nhiều tình huống.",
    programming:
      "Thiết kế ứng dụng có nhiều thành phần, viết kiểm thử, xử lý bảo mật và tối ưu hiệu năng; giải thích được lựa chọn kỹ thuật.",
  },
  EXPERT: {
    summary:
      "Có kiến thức chuyên sâu, xử lý vấn đề khó và hướng dẫn được người khác.",
    language:
      "Hiểu sắc thái, thành ngữ và nội dung chuyên sâu; giao tiếp, viết chính xác theo ngữ cảnh và hướng dẫn người học ở mức cao.",
    programming:
      "Thiết kế hệ thống phức tạp, phân tích đánh đổi và giải quyết sự cố khó; đánh giá giải pháp và hướng dẫn các lập trình viên khác.",
  },
};

export function SkillLevelGuide({ level }: { level: SkillLevel }) {
  const guide = guidance[level];
  return (
    <View style={formStyles.levelGuide}>
      <Text style={formStyles.label}>Gợi ý cho mức {levelLabels[level]}</Text>
      <Text style={skillStyles.body}>{guide.summary}</Text>
      <Text style={skillStyles.body}>
        <Text style={formStyles.label}>Ngôn ngữ: </Text>
        {guide.language}
      </Text>
      <Text style={skillStyles.body}>
        <Text style={formStyles.label}>Lập trình: </Text>
        {guide.programming}
      </Text>
      <Text style={skillStyles.caption}>
        Ví dụ giúp bạn tự đánh giá; không phải tiêu chí xác minh hoặc quy đổi
        chứng chỉ.
      </Text>
    </View>
  );
}
