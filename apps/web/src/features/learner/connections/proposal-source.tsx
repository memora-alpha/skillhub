"use client";

import Link from "next/link";
import type { Proposal, Skill } from "../types";
import { useUserResource } from "../hooks/use-user-resource";
import styles from "../discovery/discovery.module.css";

export function ProposalSource({ proposal }: Readonly<{ proposal: Proposal }>) {
  const direct = proposal.sourceType === "DIRECT_SEARCH";
  const skill = useUserResource<Skill>("skills/" + proposal.skillId);
  return (
    <div className={styles.source}>
      <strong>
        {direct ? "Lời mời trực tiếp từ hồ sơ" : "Đề nghị từ bài nhu cầu học"}
      </strong>
      {skill.data && <span>Kỹ năng: {skill.data.name}</span>}
      {!direct && proposal.learningRequestId && (
        <Link
          className="learner-card-link"
          href={"/learn/posts/" + proposal.learningRequestId}
        >
          Xem bài nguồn
        </Link>
      )}
      {direct && (
        <Link
          className="learner-card-link"
          href={"/learn/people/" + proposal.recipientId}
        >
          Hồ sơ người chia sẻ
        </Link>
      )}
    </div>
  );
}
