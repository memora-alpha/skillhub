"use client";
import { useUserResource } from "../hooks/use-user-resource";
import {
  Back,
  Feedback,
  PageHeading,
  Panel,
  formatTime,
} from "../components/common";
import { ProposalCard } from "./connections-screen";
import type { Proposal } from "../types";
export function ProposalDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<Proposal>("proposals/" + id);
  const proposal = query.data;
  return (
    <>
      <Back href="/learn/connections" />
      <PageHeading
        eyebrow="KẾT NỐI HỌC TẬP"
        title="Chi tiết đề nghị"
        description="Xem lời nhắn và điều kiện gợi ý trước khi bắt đầu trao đổi."
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {proposal && (
        <div className="learner-two-columns">
          <ProposalCard proposal={proposal} />
          <Panel title="Thông tin đề nghị">
            <p>Gửi lúc {formatTime(proposal.createdAt)}</p>
            <p>Phiên bản: {proposal.version}</p>
            <p>
              Hình thức:{" "}
              {exchangeLabels[proposal.exchangeTypeHint ?? ""] ?? "Chưa chọn"}
            </p>
            <p className="muted">
              Đề nghị là bước kết nối. Credit và lịch học sẽ được hai bên xác
              nhận trong thỏa thuận.
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}

const exchangeLabels: Record<string, string> = {
  TWO_WAY: "Trao đổi hai chiều",
  ONE_WAY: "Hướng dẫn một chiều",
};
