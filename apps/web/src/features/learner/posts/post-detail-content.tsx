import type { ReactNode } from "react";
import { ProductIcon } from "../components/product-icon";
import { Status, formatTime } from "../components/common";
import type { Post } from "../types";
import { PostSkillName, PostSelectedTags } from "./post-catalog";
import {
  postDisplayState,
  postLevels,
  postStatusLabel,
} from "./post-presentation";
import styles from "./posts.module.css";

const weekdays = [
  ["MON", "Thứ Hai"],
  ["TUE", "Thứ Ba"],
  ["WED", "Thứ Tư"],
  ["THU", "Thứ Năm"],
  ["FRI", "Thứ Sáu"],
  ["SAT", "Thứ Bảy"],
  ["SUN", "Chủ nhật"],
] as const;

export function PostSection({
  title,
  icon,
  children,
  className = "",
}: Readonly<{
  title: string;
  icon: "book" | "calendar" | "users";
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={styles.section + " " + className}>
      <h2 className={styles.sectionTitle}>
        <ProductIcon name={icon} size={18} />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PostDetailContent({
  post,
  owner,
  expired,
}: Readonly<{ post: Post; owner: boolean; expired: boolean }>) {
  const availability = post.preferredAvailability;
  return (
    <>
      <section className={styles.summary}>
        <div className={styles.tags}>
          <Status
            value={postDisplayState(post)}
            label={postStatusLabel(post)}
          />
          {owner && post.moderationStatus === "APPROVED" && (
            <span className={styles.verified}>
              <ProductIcon name="check" size={14} />
              Đã duyệt
            </span>
          )}
        </div>
        <h1>{post.title}</h1>
        <div className={styles.metadata}>
          <ProductIcon name="book" size={17} />
          <strong>
            {post.skill?.name ?? <PostSkillName id={post.skillId} />}
          </strong>
          {post.currentLevel && (
            <span className={styles.tag}>
              {postLevels[post.currentLevel] ?? post.currentLevel}
            </span>
          )}
        </div>
        {!!post.tags?.length && (
          <div className={styles.tags} aria-label="Chủ đề">
            {post.tags.map((tag) => (
              <span className={styles.tag} key={tag.id}>
                {tag.label}
              </span>
            ))}
          </div>
        )}
        {owner && !post.tags?.length && !!post.tagIds?.length && (
          <PostSelectedTags ids={post.tagIds} />
        )}
        <div className={styles.dates}>
          <div className={styles.metadata}>
            <ProductIcon name="clock" size={15} />
            <span>
              {post.publishedAt ? "Đã đăng" : "Ngày tạo"}:{" "}
              {formatTime(post.publishedAt ?? post.createdAt)}
            </span>
          </div>
          {post.expiresAt && (
            <div className={styles.metadata}>
              <ProductIcon name="calendar" size={15} />
              <span>
                {expired ? "Đã hết hạn" : "Hạn nhận đề xuất"}:{" "}
                {formatTime(post.expiresAt)}
              </span>
            </div>
          )}
          {post.verifiedTeacherOnly && (
            <div className={styles.metadata}>
              <ProductIcon name="shield" size={15} />
              <span>Chỉ nhận người có kỹ năng đã xác minh</span>
            </div>
          )}
        </div>
        {owner && !!post.proposedTags?.length && (
          <details className={styles.pendingTags}>
            <summary>{post.proposedTags.length} tag đề xuất</summary>
            <div className={styles.tags}>
              {post.proposedTags.map((tag) => (
                <span className={styles.tag} key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </details>
        )}
      </section>
      {owner && post.moderationRejectReason && (
        <p role="note" className="learner-error">
          Lý do chưa duyệt: {post.moderationRejectReason}
        </p>
      )}
      {postDisplayState(post) === "PENDING_MODERATION" && (
        <p className={styles.caption}>Bài đang chờ duyệt, chưa nhận đề xuất.</p>
      )}
      <PostSection
        title={owner ? "Tôi muốn học" : "Nhu cầu học tập"}
        icon="book"
      >
        {post.description && post.description !== post.learningGoal && (
          <p>{post.description}</p>
        )}
        <div className={styles.goal}>
          <strong>Mục tiêu kỳ vọng</strong>
          <p>{post.learningGoal}</p>
        </div>
      </PostSection>
      {(post.teachingOverview || !!post.offeredSharingSkills?.length) && (
        <PostSection
          title={owner ? "Tôi có thể dạy lại" : "Kỹ năng dạy lại"}
          icon="users"
          className={styles.exchange}
        >
          {post.teachingOverview && <p>{post.teachingOverview}</p>}
          {!!post.offeredSharingSkills?.length && (
            <div className={styles.tags}>
              {post.offeredSharingSkills.map((skill) => (
                <span key={skill.id} className={styles.tag}>
                  <strong>{skill.skill.name}</strong> ·{" "}
                  {skill.skillLevel?.name ??
                    postLevels[skill.level] ??
                    skill.level}
                  {skill.verificationStatus === "VERIFIED" && (
                    <span
                      className={styles.verified}
                      aria-label="Đã xác minh kỹ năng"
                    >
                      <ProductIcon name="check" size={14} />
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </PostSection>
      )}
      {(!!availability?.weeklySlots.length ||
        !!post.preferredSlots?.length) && (
        <PostSection title="Lịch rảnh" icon="calendar">
          <div className={styles.schedule}>
            {!!availability?.weeklySlots.length && (
              <>
                <p className={styles.caption}>
                  {["Asia/Ho_Chi_Minh", "Asia/Saigon"].includes(
                    availability.timeZone,
                  )
                    ? "Giờ Việt Nam · Lặp hằng tuần"
                    : availability.timeZone + " · Lặp hằng tuần"}
                </p>
                {weekdays.map(([weekday, label]) => {
                  const slots = availability.weeklySlots.filter(
                    (slot) => slot.weekday === weekday,
                  );
                  return slots.length ? (
                    <div key={weekday} className={styles.scheduleRow}>
                      <strong>{label}</strong>
                      <div className={styles.tags}>
                        {slots.map((slot) => (
                          <span
                            className={styles.tag}
                            key={JSON.stringify([
                              slot.weekday,
                              slot.startTime,
                              slot.endTime,
                            ])}
                          >
                            {slot.startTime} – {slot.endTime}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })}
              </>
            )}
            {!!post.preferredSlots?.length && (
              <>
                <p className={styles.caption}>Ngày cụ thể · Giờ Việt Nam</p>
                {post.preferredSlots.map((slot) => (
                  <div
                    className={styles.tag}
                    key={JSON.stringify([slot.startAt, slot.endAt])}
                  >
                    {formatTime(slot.startAt)} – {formatTime(slot.endAt)}
                  </div>
                ))}
              </>
            )}
            <p className={styles.caption}>
              Thời gian gợi ý, chưa chốt lịch học.
            </p>
          </div>
        </PostSection>
      )}
    </>
  );
}
