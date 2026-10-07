import { conversations } from "./conversations";

export type ChatMessage = {
  id: string;
  from: "them" | "me";
  text: string;
  time: string;
};
const reactMessages: ChatMessage[] = [
  {
    id: "seed-1",
    from: "them",
    text: "Chào bạn! Mình thấy yêu cầu học React của bạn rất thú vị.",
    time: "14:20",
  },
  {
    id: "seed-2",
    from: "me",
    text: "Chào anh! Mình là người mới bắt đầu, chỉ biết HTML/CSS cơ bản.",
    time: "14:22",
  },
  {
    id: "seed-3",
    from: "them",
    text: "Không sao, mình sẽ dạy từ đầu. Bạn có mục tiêu cụ thể không?",
    time: "14:23",
  },
  {
    id: "seed-4",
    from: "me",
    text: "Mình muốn xây dựng được một ứng dụng web hoàn chỉnh bằng React trong 2 tháng.",
    time: "14:25",
  },
  {
    id: "seed-5",
    from: "them",
    text: "2 tháng là hoàn toàn khả thi! Mình đề xuất 6 buổi, mỗi buổi 90 phút, tập trung vào dự án thực tế.",
    time: "14:26",
  },
];
export const initialThreads: Record<string, ChatMessage[]> = Object.fromEntries(
  conversations.map((item) => [
    item.proposal,
    item.proposal === "DX-2402"
      ? reactMessages
      : [
          {
            id: `seed-${item.proposal}`,
            from: "them" as const,
            text: item.last,
            time: item.time,
          },
        ],
  ]),
);
export const chatCopy = {
  acceptedTitle: "ĐỀ XUẤT ĐÃ ĐƯỢC CHẤP NHẬN",
  acceptedBody:
    "Hai bạn có thể trao đổi và chọn hình thức học. Chưa có Credit hay lịch nào bị khóa.",
  nextStepTitle: "Chọn cách hai bạn sẽ học cùng nhau",
  nextStepBody:
    "Trao đổi hai chiều hoặc học một chiều. Xác nhận phải thực hiện trên thẻ này.",
  footer:
    "Tệp tối đa 15 MB · Xác nhận nghiệp vụ chỉ có hiệu lực qua thẻ hành động",
};
