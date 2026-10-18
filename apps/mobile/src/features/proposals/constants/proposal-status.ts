import type { Proposal } from "../api/proposals-api";
export const proposalStatusLabels: Record<Proposal["status"], string> = {
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Đã rút",
  EXPIRED: "Đã hết hạn",
};
