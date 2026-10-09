import { demoConversations } from "@/features/messages";

export type ProposalStatus =
  "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
export type DemoProposal = {
  id: string;
  direction: "received" | "sent";
  sourceType: "LEARNING_REQUEST" | "DIRECT_SEARCH";
  requestId?: string;
  requestTitle: string;
  partnerId: string;
  partner: string;
  skill: string;
  message: string;
  credit: string;
  sessions: number;
  schedule: string;
  time: string;
  status: ProposalStatus;
  // UI-only note; no backend rejection DTO is defined yet.
  localDecisionNote?: string;
};

export const demoTeachingSkills = [
  { id: "react", name: "React", verified: true },
  { id: "javascript", name: "JavaScript", verified: true },
  { id: "typescript", name: "TypeScript", verified: false },
];

export const initialProposals: DemoProposal[] = [
  ...[
    {
      id: "DX-2410",
      partnerId: "demo-viet-anh",
      partner: "Trần Việt Anh",
      credit: "50",
      time: "2 giờ trước",
      message:
        "Mình có thể hướng dẫn React theo dự án thực tế, từ component và hooks đến một ứng dụng hoàn chỉnh.",
    },
    {
      id: "DX-2411",
      partnerId: "demo-minh-khang",
      partner: "Nguyễn Minh Khang",
      credit: "45",
      time: "4 giờ trước",
      message:
        "Mình có kinh nghiệm React và TypeScript. Có thể giúp bạn xây dựng ứng dụng từ những kiến thức nền tảng.",
    },
    {
      id: "DX-2412",
      partnerId: "demo-thu-ha",
      partner: "Phạm Thu Hà",
      credit: "60",
      time: "Hôm qua",
      message:
        "Mình có thể hướng dẫn React vào cuối tuần, cùng thực hành và xem lại từng bài tập.",
    },
  ].map((item): DemoProposal => ({
    ...item,
    direction: "received",
    sourceType: "LEARNING_REQUEST",
    requestId: "my-react",
    requestTitle: "Muốn học React từ cơ bản đến nâng cao",
    skill: "React",
    sessions: 6,
    schedule: "Tối Thứ 5 và Thứ 7",
    status: "PENDING",
  })),
  ...demoConversations.map((item): DemoProposal => ({
    id: item.proposal,
    direction: "received",
    sourceType: "LEARNING_REQUEST",
    requestId: `accepted-${item.proposal}`,
    requestTitle: item.request,
    partnerId: item.userId,
    partner: item.name,
    skill: item.skill,
    message:
      "Đề xuất đã được chấp nhận trong dữ liệu mẫu. Hai người tiếp tục trao đổi trong Chat.",
    credit: "30",
    sessions: 4,
    schedule: "Thương lượng trong Chat",
    time: item.time,
    status: "ACCEPTED",
  })),
  {
    id: "demo-direct-invitation",
    direction: "received",
    sourceType: "DIRECT_SEARCH",
    requestTitle: "Lời mời học React từ hồ sơ công khai",
    partnerId: "demo-hong-anh",
    partner: "Nguyễn Hồng Anh",
    skill: "React",
    message:
      "Mình muốn cùng bạn trao đổi cách xây dựng giao diện React và thực hành một dự án nhỏ vào cuối tuần.",
    credit: "30",
    sessions: 4,
    schedule: "Cuối tuần, trao đổi thêm sau khi kết nối",
    time: "Dữ liệu mẫu",
    status: "PENDING",
  },
  {
    id: "demo-expired-proposal",
    direction: "sent",
    sourceType: "DIRECT_SEARCH",
    requestTitle: "Lời mời trao đổi React",
    partnerId: "demo-thu-ha",
    partner: "Phạm Thu Hà",
    skill: "React",
    message:
      "Mình có thể chia sẻ React qua các bài tập thực hành, cùng xem lại kết quả sau mỗi buổi.",
    credit: "40",
    sessions: 4,
    schedule: "Chưa thống nhất",
    time: "Dữ liệu mẫu",
    status: "EXPIRED",
  },
];
