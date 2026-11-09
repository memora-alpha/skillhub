"use client";
import { systemCodeLabel } from "@/lib/system-text";

import Link from "next/link";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserList } from "../hooks/use-user-resource";
import {
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
  Status,
} from "../components/common";
import { ProfileAvatar } from "../components/profile-avatar";
import { SkillPicker } from "../components/skill-picker";
import type { SkillSharer } from "./discovery-types";
import styles from "./discovery.module.css";

export function SharersScreen({
  initialSkillId = "",
}: Readonly<{ initialSkillId?: string }>) {
  const [skillId, setSkillId] = useState(initialSkillId);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  return (
    <>
      <PageHeading title="Tìm người chia sẻ kỹ năng" />
      <Panel className={styles.filters}>
        <SkillPicker value={skillId} onChange={setSkillId} />
        <label className={styles.verifiedFilter}>
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(event) => setVerifiedOnly(event.target.checked)}
          />
          <span>Chỉ hiện kỹ năng đã được xác minh</span>
        </label>
      </Panel>
      {skillId ? (
        <SharerResults
          key={skillId + ":" + verifiedOnly}
          skillId={skillId}
          verifiedOnly={verifiedOnly}
        />
      ) : (
        <Empty>Chọn một kỹ năng để tìm người có thể hướng dẫn bạn.</Empty>
      )}
    </>
  );
}

function SharerResults({
  skillId,
  verifiedOnly,
}: Readonly<{ skillId: string; verifiedOnly: boolean }>) {
  const { actor } = useUserSession();
  const query = useUserList<SkillSharer>(
    "skills/" + skillId + "/sharers?limit=20&verifiedOnly=" + verifiedOnly,
  );
  const people = query.items.filter((row) => row.user.userId !== actor.userId);
  return (
    <div aria-live="polite">
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-post-grid">
        {people.map((row) => (
          <Panel key={row.id}>
            <div className={styles.person}>
              <ProfileAvatar
                className={styles.avatar}
                fullName={row.user.fullName}
                avatarUrl={row.user.avatarUrl}
              />
              <div>
                <h2>
                  <Link
                    className="learner-card-link"
                    href={"/learn/people/" + row.user.userId}
                  >
                    {row.user.fullName}
                  </Link>
                </h2>
                <p>Uy tín: {row.user.reputationScore}/100</p>
              </div>
            </div>
            <p>
              <strong>{row.skill.name}</strong> ·{" "}
              {row.skillLevel?.name ??
                systemCodeLabel(row.level, "Chưa xác định trình độ")}
            </p>
            <Status value={row.verificationStatus} />
            <p className="learner-prose">{row.description}</p>
            {row.experienceYears && (
              <p>Kinh nghiệm: {row.experienceYears} năm</p>
            )}
            <Link
              className="btn btn-primary"
              href={"/learn/people/" + row.user.userId + "#public-skills"}
            >
              Xem hồ sơ & gửi lời mời
            </Link>
          </Panel>
        ))}
      </div>
      {!query.loading && !query.error && !people.length && (
        <Empty>
          {query.cursor
            ? "Chưa có người phù hợp trên trang này. Xem thêm để tiếp tục tìm."
            : "Chưa có người phù hợp. Thử kỹ năng khác hoặc bỏ bộ lọc xác minh."}
        </Empty>
      )}
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
    </div>
  );
}
