export type Conversation = {
  proposal: string;
  name: string;
  userId: string;
  skill: string;
  request: string;
  last: string;
  messages: number;
  unread: number;
  time: string;
};
// Only accepted proposals appear in the source's conversation list.
export const conversations: Conversation[] = [
  {
    proposal: "DX-2402",
    name: "Trần Việt Anh",
    userId: "demo-viet-anh",
    skill: "React",
    request: "Muốn học React từ cơ bản đến nâng cao",
    last: "2 tháng là hoàn toàn khả thi!",
    messages: 12,
    unread: 2,
    time: "14:26",
  },
  {
    proposal: "DX-2388",
    name: "Nguyễn Minh Hà",
    userId: "demo-minh-ha",
    skill: "Tiếng Anh / IELTS",
    request: "Luyện IELTS Speaking lên 7.0",
    last: "Mình đã cập nhật lịch rồi nhé.",
    messages: 28,
    unread: 0,
    time: "11:02",
  },
  {
    proposal: "DX-2314",
    name: "Đỗ Quang Huy",
    userId: "demo-quang-huy",
    skill: "Python",
    request: "Python cho Data Science",
    last: "Bạn xem lộ trình Python giúp mình.",
    messages: 9,
    unread: 0,
    time: "Thứ 2",
  },
];
export const conversationHint =
  "Mỗi Proposal được chấp nhận mở một cuộc trò chuyện riêng. Một cuộc trò chuyện có thể chứa nhiều tin nhắn và các thẻ xác nhận nghiệp vụ.";
