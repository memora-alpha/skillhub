"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { achievementTitle } from "@/lib/i18n/system-copy";
import Link from "next/link";
import { useState } from "react";
import type { SharingSkill } from "../types";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserSession } from "../auth/session";
import { CommandFeedback, Feedback, Panel, Status } from "../components/common";
import type { OwnIdentity } from "./account-types";
import { ProfileAvatar } from "../components/profile-avatar";
import { profileUpdate } from "./profile-update";
import { AvatarEditor } from "./avatar-editor";
import { AccountSecurity } from "./account-security";
import { RatingSummary } from "./profile-reviews";
import styles from "../components/learning-layout.module.css";
export function ProfileScreen() {
  const skills = useUserPagedList<SharingSkill>("me/skills?limit=3");
  const query = useUserResource<OwnIdentity>("me", {
      refetchInterval: (data) => (data?.profile.avatarUrl ? 45000 : false),
    }),
    command = useUserCommand(),
    { request, actor } = useUserSession(),
    [saved, setSaved] = useState(false),
    [profileError, setProfileError] = useState<string>();
  const me = query.data;
  return (
    <>
      <Feedback
        variant="profile"
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      {me && (
        <>
          {me.profile.profileModeration &&
            Object.entries(me.profile.profileModeration).map(
              ([field, item]) => (
                <p className="learner-notice" key={field}>
                  {field === "bio" ? "Giới thiệu" : "Ảnh đại diện"}:{" "}
                  {item.action === "HIDE" ? "Đã bị ẩn" : "Cần cập nhật"}.{" "}
                  {item.reason}
                </p>
              ),
            )}
          <section className="learner-card product-profile-hero">
            <ProfileAvatar
              className="product-profile-avatar"
              fullName={me.profile.fullName}
              avatarUrl={me.profile.avatarUrl}
            />
            <div>
              <h1>{me.profile.fullName}</h1>
              <p>{me.profile.headline || "Thành viên SkillHub"}</p>
              <p>{achievementTitle(me.profile.selectedTitle)}</p>
              <Link
                className="learner-card-link"
                href={"/learn/people/" + actor.userId}
              >
                Xem hồ sơ công khai →
              </Link>
            </div>
            <Link className="btn" href="/learn/skills">
              Quản lý kỹ năng →
            </Link>
          </section>
          <div className={styles.profileGrid}>
            <div className={styles.profileMain}>
              <Panel title="Thông tin cá nhân">
                <form
                  className={"learner-form " + styles.profileForm}
                  key={
                    me.profile.fullName +
                    ":" +
                    me.profile.headline +
                    ":" +
                    me.profile.bio +
                    ":" +
                    (me.profile.timezone ?? "") +
                    ":" +
                    me.profile.locale
                  }
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSaved(false);
                    const data = new FormData(e.currentTarget);
                    setProfileError(undefined);
                    let body: ReturnType<typeof profileUpdate>;
                    try {
                      body = profileUpdate(me.profile, data);
                    } catch (cause) {
                      setProfileError(
                        cause instanceof Error
                          ? cause.message
                          : "Kiểm tra lại hồ sơ.",
                      );
                      return;
                    }
                    if (!Object.keys(body).length) {
                      setSaved(true);
                      return;
                    }
                    const result = await command.run(JSON.stringify(body), () =>
                      request("me/profile", { method: "PATCH", body }),
                    );
                    if (result) {
                      setSaved(true);
                      query.reload();
                    }
                  }}
                >
                  <label>
                    <span>Họ và tên</span>
                    <input
                      name="fullName"
                      defaultValue={me.profile.fullName}
                      minLength={2}
                      maxLength={100}
                      required
                      disabled={command.pending || command.uncertain}
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input value={me.email} readOnly type="email" />
                    <small>
                      Email tài khoản chỉ hiển thị với bạn, không bao giờ công
                      khai trên hồ sơ cộng đồng.
                    </small>
                  </label>
                  <label>
                    <span>Tiêu đề giới thiệu</span>
                    <input
                      name="headline"
                      defaultValue={me.profile.headline}
                      maxLength={120}
                      disabled={command.pending || command.uncertain}
                      placeholder="Bạn muốn chia sẻ điều gì với cộng đồng?"
                    />
                  </label>
                  <label>
                    <span>Múi giờ</span>
                    <input
                      name="timezone"
                      defaultValue={me.profile.timezone ?? "Asia/Ho_Chi_Minh"}
                      required
                      maxLength={100}
                      disabled={command.pending || command.uncertain}
                    />
                  </label>
                  <label>
                    <span>Ngôn ngữ</span>
                    <select
                      name="locale"
                      defaultValue={me.profile.locale}
                      disabled={command.pending || command.uncertain}
                    >
                      <option value="vi">Tiếng Việt</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                  <label>
                    <span>Giới thiệu bản thân</span>
                    <textarea
                      name="bio"
                      defaultValue={me.profile.bio}
                      rows={5}
                      maxLength={1000}
                      disabled={command.pending || command.uncertain}
                    />
                  </label>

                  <Feedback error={profileError} />
                  <CommandFeedback command={command} />
                  {saved && (
                    <p className="learner-notice">
                      <output>Đã lưu hồ sơ.</output>
                    </p>
                  )}
                  <LoadingButton
                    type="submit"
                    className="btn btn-primary"
                    disabled={command.pending || command.uncertain}
                    loading={!!command.pending}
                  >
                    {command.pending ? "Đang lưu…" : "Lưu thay đổi"}
                  </LoadingButton>
                </form>
              </Panel>
              <Panel>
                <AvatarEditor onSaved={query.reload} />
              </Panel>
            </div>
            <aside className={styles.sideStack}>
              <Panel title="Hành trình trên SkillHub">
                <p>
                  {achievementTitle(me.profile.selectedTitle) ??
                    "Chưa chọn danh hiệu"}
                </p>
                <Link className="learner-card-link" href="/learn/achievements">
                  Thành tích & danh hiệu →
                </Link>
                <div className={styles.stats}>
                  <div>
                    <strong>{me.profile.reputationScore}</strong>
                    <small>Điểm uy tín</small>
                    <Link href="/learn/reputation">Xem lịch sử & hạn chế</Link>
                  </div>
                  <div>
                    <strong>{me.profile.completedLearningPathCount}</strong>
                    <small>Lộ trình hoàn tất</small>
                  </div>
                  <div>
                    <strong>{me.profile.verifiedSkillCount}</strong>
                    <small>Kỹ năng đã xác minh</small>
                  </div>
                  <div>
                    <strong>{me.profile.completedSessionCount}</strong>
                    <small>Buổi đã hoàn thành</small>
                  </div>
                </div>
              </Panel>
              <Panel title="Đánh giá đã nhận" className={styles.summaryLink}>
                <RatingSummary summary={me.profile.reviewSummary} />
                <Link className="btn" href="/learn/reviews">
                  Xem đánh giá của tôi →
                </Link>
              </Panel>
              <details>
                <summary>Kỹ năng của bạn</summary>
                <Panel title="Kỹ năng của bạn">
                  <Feedback
                    loading={skills.initialLoading}
                    error={skills.error}
                    reload={skills.reload}
                    refreshing={!!(skills.loading && !skills.initialLoading)}
                  />
                  {skills.items.map((skill) => (
                    <div className="product-pending" key={skill.id}>
                      <strong>{skill.skill.name}</strong>
                      <p>
                        {skill.level} ·{" "}
                        {skill.isVisible ? "Đang hiển thị" : "Đang ẩn"}
                      </p>
                      {skill.verificationStatus && (
                        <Status value={skill.verificationStatus} />
                      )}
                      <p>
                        <Link
                          className="learner-card-link"
                          href={"/learn/skills/" + skill.id + "/verification"}
                        >
                          Chi tiết xác minh →
                        </Link>
                      </p>
                    </div>
                  ))}
                  {!skills.loading && !skills.error && !skills.items.length && (
                    <p>Bạn chưa khai báo kỹ năng chia sẻ.</p>
                  )}
                  <ListPagination query={skills} />
                  <p>
                    <Link className="btn" href="/learn/skills">
                      Quản lý kỹ năng
                    </Link>
                  </p>
                </Panel>
              </details>
              <Panel title="Tài khoản & hỗ trợ">
                <AccountSecurity />
                <p>Theo dõi các báo cáo bạn đã gửi trong quá trình học.</p>
                <Link className="learner-card-link" href="/learn/reports">
                  Báo cáo của tôi →
                </Link>
              </Panel>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
