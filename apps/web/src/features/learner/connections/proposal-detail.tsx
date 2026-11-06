"use client";
import { useUserResource } from "../hooks/use-user-resource";
import {
  Back,
  Feedback,
  PageHeading,
  Panel,
  formatTime,
} from "../components/common";
import { ProposalCard } from "./proposal-card";
import styles from "./connections.module.css";
import type { Proposal } from "../types";
export function ProposalDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<Proposal>("proposals/" + id);
  const proposal = query.data;
  return (
    <>
      <Back href="/learn/connections" />
      <PageHeading title="Chi tiết đề nghị" />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {proposal && (
        <div className={styles.detail}>
          <ProposalCard proposal={proposal} detail />
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
