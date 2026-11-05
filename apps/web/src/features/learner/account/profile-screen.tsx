"use client";
import { achievementTitle } from "@/lib/i18n/system-copy";
import { formText } from "../components/form-data";
import Link from "next/link";
import { useState } from "react";
import type { SharingSkill } from "../types";
import { useUserResource, useUserList } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserSession } from "../auth/session";
import {
  CommandFeedback,
  Feedback,
  PageHeading,
  Panel,
  Status,
  More,
} from "../components/common";
import type { OwnIdentity } from "./account-types";
import { ProfileAvatar } from "../components/profile-avatar";
import { AvatarEditor } from "./avatar-editor";
import { AccountSecurity } from "./account-security";
export function ProfileScreen() {
  const skills = useUserList<SharingSkill>("me/skills?limit=3");
  const query = useUserResource<OwnIdentity>("me"),
    command = useUserCommand(),
    { request, actor } = useUserSession(),
    [saved, setSaved] = useState(false);
  const me = query.data;
  return (
    <>
      <PageHeading
        eyebrow="KHÔNG GIAN CỦA BẠN"
        title="Hồ sơ cá nhân"
        description="Giới thiệu bản thân và những kỹ năng bạn muốn chia sẻ."
      />
      <p>
        <Link
          className="learner-card-link"
          href={"/learn/people/" + actor.userId}
        >
          Xem hồ sơ công khai của tôi →
        </Link>
      </p>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {me && (
        <>
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
            </div>
            <Link className="btn" href="/learn/skills">
              Quản lý kỹ năng →
            </Link>
          </section>
          <div className="learner-two-columns">
            <Panel title="Thông tin cá nhân">
              <AvatarEditor onSaved={query.reload} />
              <form
                className="learner-form"
                key={
                  me.profile.fullName +
                  ":" +
                  me.profile.headline +
                  ":" +
                  me.profile.bio
                }
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaved(false);
                  const data = new FormData(e.currentTarget);
                  const body = {
                    fullName: formText(data, "fullName").trim(),
                    headline: formText(data, "headline").trim(),
                    bio: formText(data, "bio").trim(),
                    timezone: formText(data, "timezone"),
                    locale: me.profile.locale,
                  };
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
                  <small>Email tài khoản được quản lý bởi hệ thống.</small>
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
                  <span>Giới thiệu bản thân</span>
                  <textarea
                    name="bio"
                    defaultValue={me.profile.bio}
                    rows={5}
                    maxLength={1000}
                    disabled={command.pending || command.uncertain}
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
                <CommandFeedback command={command} />
                {saved && (
                  <p className="learner-notice">
                    <output>Đã lưu hồ sơ.</output>
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={command.pending || command.uncertain}
                >
                  {command.pending ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </form>
            </Panel>
            <div className="learner-stack">
              <Panel title="Hành trình trên SkillHub">
                <p>
                  {achievementTitle(me.profile.selectedTitle) ??
                    "Chưa chọn danh hiệu"}
                </p>
                <Link className="learner-card-link" href="/learn/achievements">
                  Thành tích & danh hiệu →
                </Link>
                <div className="product-profile-stats">
                  <div>
                    <strong>{me.profile.reputationScore}</strong>
                    <small>Điểm uy tín</small>
                    <Link href="/learn/reputation">Xem lịch sử & hạn chế</Link>
                  </div>
                  <div>
                    <strong>{me.profile.completedSessionCount}</strong>
                    <small>Buổi hoàn thành</small>
                  </div>
                  <div>
                    <strong>{me.profile.verifiedSkillCount}</strong>
                    <small>Kỹ năng đã xác minh</small>
                  </div>
                </div>
              </Panel>
              <Panel title="Kỹ năng của bạn">
                <Feedback
                  loading={skills.loading}
                  error={skills.error}
                  reload={skills.reload}
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
                <More
                  cursor={skills.cursor}
                  loading={skills.loading}
                  onMore={() => {
                    void skills.more();
                  }}
                />
                <p>
                  <Link className="btn" href="/learn/skills">
                    Quản lý kỹ năng
                  </Link>
                </p>
              </Panel>
              <Panel title="Hỗ trợ học tập">
                <AccountSecurity />
                <p>Theo dõi các báo cáo bạn đã gửi trong quá trình học.</p>
                <Link className="learner-card-link" href="/learn/reports">
                  Báo cáo của tôi →
                </Link>
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}
