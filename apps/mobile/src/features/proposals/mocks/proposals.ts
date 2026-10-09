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
];
