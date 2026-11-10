"use client";
import { systemCodeLabel } from "@/lib/system-text";

import Link from "next/link";
import { achievementTitle } from "@/lib/i18n/system-copy";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import {
  Back,
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
  Status,
} from "../components/common";
import { ProfileAvatar } from "../components/profile-avatar";
import { DirectInvitationForm } from "./direct-invitation-form";
import type { PublicProfile, PublicSharingSkill } from "./discovery-types";
import styles from "./discovery.module.css";
import { ProfileReviews, RatingSummary } from "../account/profile-reviews";

export function PublicProfileScreen({ userId }: Readonly<{ userId: string }>) {
  const query = useUserResource<PublicProfile>("profiles/" + userId);
  const { actor } = useUserSession();
  const profile = query.data;
  return (
    <>
      <Back href="/learn/explore?view=sharers">Tìm người chia sẻ</Back>
      <PageHeading title="Hồ sơ công khai" />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {profile && (
        <>
          <Panel className={styles.profile}>
            <div className={styles.person}>
              <ProfileAvatar
                className={styles.avatar}
                fullName={profile.fullName}
                avatarUrl={profile.avatarUrl}
              />
              <div>
                <h2>{profile.fullName}</h2>
                <p>{profile.headline || "Thành viên SkillHub"}</p>
                {profile.selectedTitle && (
                  <p>{achievementTitle(profile.selectedTitle)}</p>
                )}
              </div>
            </div>
            <p className="learner-prose">
              {profile.bio || "Thành viên chưa thêm giới thiệu."}
            </p>
            <div className={styles.stats}>
              <div>
                <strong>{profile.reputationScore}/100</strong>
                <span>Điểm uy tín</span>
              </div>
              <div>
                <strong>{profile.verifiedSkillCount}</strong>
                <span>Kỹ năng đã xác minh</span>
              </div>
              <div>
                <strong>{profile.completedLearningPathCount}</strong>
                <span>Lộ trình đã hoàn tất</span>
              </div>
            </div>
            <p>{profile.completedSessionCount} buổi đã hoàn thành</p>
            <RatingSummary summary={profile.reviewSummary} />
            {actor.userId === userId && (
              <Link className="btn" href="/learn/profile">
                Chỉnh sửa hồ sơ của tôi
              </Link>
            )}
          </Panel>
          <PublicSkills userId={userId} fullName={profile.fullName} />
          <ProfileReviews userId={userId} />
        </>
      )}
    </>
  );
}

function PublicSkills({
  userId,
  fullName,
}: Readonly<{ userId: string; fullName: string }>) {
  const query = useUserList<PublicSharingSkill>(
    "profiles/" + userId + "/skills?limit=20",
  );
  const { actor } = useUserSession();
  return (
    <section
      className={styles.skills}
      id="public-skills"
      aria-labelledby="public-skills-heading"
    >
      <h2 id="public-skills-heading">Kỹ năng đang chia sẻ</h2>
      <p>
        Chọn kỹ năng bạn muốn học để gửi lời mời. Kỹ năng ẩn hoặc đã lưu trữ
        không xuất hiện ở đây.
      </p>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-stack">
        {query.items.map((skill) => (
          <PublicSkillCard
            key={skill.id}
            skill={skill}
            userId={userId}
            fullName={fullName}
            own={actor.userId === userId}
          />
        ))}
      </div>
      {!query.loading && !query.error && !query.items.length && (
        <Empty>Thành viên chưa có kỹ năng công khai.</Empty>
      )}
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
    </section>
  );
}

function PublicSkillCard({
  skill,
  userId,
  fullName,
  own,
}: Readonly<{
  skill: PublicSharingSkill;
  userId: string;
  fullName: string;
  own: boolean;
}>) {
  const [inviting, setInviting] = useState(false);
  return (
    <div className={styles.skill} id={"skill-" + skill.id}>
      <Panel title={skill.skill.name}>
        <p>
          Trình độ:{" "}
          {skill.skillLevel?.name ??
            systemCodeLabel(skill.level, "Chưa xác định trình độ")}
        </p>
        <Status value={skill.verificationStatus} />
        <p className="learner-prose">{skill.description}</p>
        {skill.experienceYears && (
          <p>Kinh nghiệm: {skill.experienceYears} năm</p>
        )}
        {!own && (
          <button
            type="button"
            className="btn btn-primary"
            aria-expanded={inviting}
            aria-controls={"invite-" + skill.id}
            onClick={() => setInviting((value) => !value)}
          >
            {inviting ? "Đóng lời mời" : "Mời " + fullName + " hướng dẫn"}
          </button>
        )}
        {inviting && (
          <div id={"invite-" + skill.id} className={styles.invitation}>
            <DirectInvitationForm
              skill={skill}
              recipientId={userId}
              fullName={fullName}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
