"use client";
import Link from "next/link";
import { useUserList } from "../hooks/use-user-resource";
import { Feedback, More } from "../components/common";
import { TagPicker } from "../tags/tag-picker";
import type { Post, SharingSkill } from "../types";
import { canOfferSkill } from "./post-policy";

export type PostExtrasValue = {
  tagIds: string[];
  proposedTags: string[];
  offeredSharingSkillIds: string[];
  teachingOverview: string;
  verifiedTeacherOnly: boolean;
  timeZone: string;
  mode: "none" | "weekly" | "slots";
  weeklySlots: {
    clientId?: string;
    weekday: string;
    startTime: string;
    endTime: string;
  }[];
  preferredSlots: { clientId?: string; startAt: string; endAt: string }[];
  expiresAt: string;
};
export const localTime = (value: string) =>
  new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16);
export function initialPostExtras(post?: Post): PostExtrasValue {
  let mode: PostExtrasValue["mode"] = "none";
  if (post?.preferredSlots?.length) mode = "slots";
  if (post?.preferredAvailability) mode = "weekly";
  return {
    tagIds: post?.tagIds ?? post?.tags?.map((tag) => tag.id) ?? [],
    proposedTags: post?.proposedTags ?? [],
    offeredSharingSkillIds: post?.offeredSharingSkillIds ?? [],
    teachingOverview: post?.teachingOverview ?? "",
    verifiedTeacherOnly: post?.verifiedTeacherOnly ?? false,
    mode,
    timeZone: post?.preferredAvailability?.timeZone ?? "Asia/Ho_Chi_Minh",
    weeklySlots:
      post?.preferredAvailability?.weeklySlots.map((slot, index) => ({
        ...slot,
        clientId: "weekly-" + index,
      })) ?? [],
    preferredSlots:
      post?.preferredSlots?.map((slot, index) => ({
        clientId: "slot-" + index,
        startAt: localTime(slot.startAt),
        endAt: localTime(slot.endAt),
      })) ?? [],
    expiresAt: post?.requestedExpiresAt
      ? localTime(post.requestedExpiresAt)
      : "",
  };
}
const days = [
  ["MON", "Thứ Hai"],
  ["TUE", "Thứ Ba"],
  ["WED", "Thứ Tư"],
  ["THU", "Thứ Năm"],
  ["FRI", "Thứ Sáu"],
  ["SAT", "Thứ Bảy"],
  ["SUN", "Chủ nhật"],
];
export function PostExtras({
  value,
  onChange,
  disabled,
}: Readonly<{
  value: PostExtrasValue;
  onChange: (value: PostExtrasValue) => void;
  disabled: boolean;
}>) {
  const skills = useUserList<SharingSkill>("me/skills?limit=50");
  const eligible = skills.items.filter(canOfferSkill);
  const change = (patch: Partial<PostExtrasValue>) =>
    onChange({ ...value, ...patch });
  return (
    <>
      <TagPicker
        ids={value.tagIds}
        proposed={value.proposedTags}
        onChange={(tagIds, proposedTags) => change({ tagIds, proposedTags })}
        disabled={disabled}
      />
      <fieldset className="learner-picker" disabled={disabled}>
        <legend>Kỹ năng bạn có thể dạy để trao đổi</legend>
        <p>
          Chỉ chọn kỹ năng của bạn đang công khai và chưa lưu trữ. Chọn ở đây
          chưa tạo thỏa thuận hay giữ Credit.
        </p>
        <Feedback
          loading={skills.loading}
          error={skills.error}
          reload={skills.reload}
        />
        {eligible.map((skill) => (
          <label key={skill.id}>
            <input
              type="checkbox"
              checked={value.offeredSharingSkillIds.includes(skill.id)}
              onChange={(e) =>
                change({
                  offeredSharingSkillIds: e.target.checked
                    ? [...value.offeredSharingSkillIds, skill.id]
                    : value.offeredSharingSkillIds.filter(
                        (id) => id !== skill.id,
                      ),
                })
              }
            />
            <span>
              {" "}
              {skill.skill.name} · {skill.level}
            </span>
          </label>
        ))}
        {value.offeredSharingSkillIds
          .filter((id) => !eligible.some((skill) => skill.id === id))
          .map((id) => (
            <p key={id}>
              Một kỹ năng đã chọn chưa có trong danh sách hiện tại; tải thêm để
              kiểm tra hoặc{" "}
              <button
                type="button"
                className="learner-text-button"
                onClick={() =>
                  change({
                    offeredSharingSkillIds: value.offeredSharingSkillIds.filter(
                      (item) => item !== id,
                    ),
                  })
                }
              >
                bỏ kỹ năng này
              </button>
              {"."}
            </p>
          ))}
        <More
          cursor={skills.cursor}
          loading={skills.loading}
          onMore={() => {
            void skills.more();
          }}
        />
        <Link className="learner-card-link" href="/learn/skills">
          Quản lý kỹ năng của tôi →
        </Link>
        <label>
          <span>Giới thiệu điều bạn có thể dạy (không bắt buộc)</span>
          <textarea
            rows={3}
            minLength={20}
            maxLength={3000}
            value={value.teachingOverview}
            onChange={(e) => change({ teachingOverview: e.target.value })}
          />
        </label>
      </fieldset>
      <fieldset className="learner-picker" disabled={disabled}>
        <legend>Lịch rảnh mong muốn</legend>
        <p>Đây là gợi ý để kết nối; chưa đặt lịch hay tạo buổi học.</p>
        <label>
          <span>Cách nhập lịch</span>
          <select
            value={value.mode}
            onChange={(e) =>
              change({ mode: e.target.value as PostExtrasValue["mode"] })
            }
          >
            <option value="none">Trao đổi sau</option>
            <option value="weekly">Lặp lại hằng tuần</option>
            <option value="slots">Ngày giờ cụ thể (giờ Việt Nam)</option>
          </select>
        </label>
        {value.mode === "weekly" && (
          <>
            <label>
              <span>Múi giờ IANA</span>
              <input
                value={value.timeZone}
                onChange={(e) => change({ timeZone: e.target.value })}
                required
                maxLength={100}
              />
            </label>
            {value.weeklySlots.map((slot, index) => (
              <fieldset key={slot.clientId} className="learner-picker">
                <legend>Khoảng rảnh {index + 1}</legend>
                <label>
                  <span>Ngày trong tuần</span>
                  <select
                    value={slot.weekday}
                    onChange={(e) =>
                      change({
                        weeklySlots: value.weeklySlots.map((item, i) =>
                          i === index
                            ? { ...item, weekday: e.target.value }
                            : item,
                        ),
                      })
                    }
                  >
                    {days.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {(["startTime", "endTime"] as const).map((field) => (
                  <label key={field}>
                    <span>
                      {field === "startTime" ? "Bắt đầu" : "Kết thúc"}
                    </span>
                    <input
                      type="time"
                      required
                      value={slot[field]}
                      onChange={(e) =>
                        change({
                          weeklySlots: value.weeklySlots.map((item, i) =>
                            i === index
                              ? { ...item, [field]: e.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    change({
                      weeklySlots: value.weeklySlots.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  Bỏ khoảng rảnh {index + 1}
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="btn"
              disabled={value.weeklySlots.length >= 5}
              onClick={() =>
                change({
                  weeklySlots: [
                    ...value.weeklySlots,
                    {
                      clientId: crypto.randomUUID(),
                      weekday: "MON",
                      startTime: "19:00",
                      endTime: "21:00",
                    },
                  ],
                })
              }
            >
              Thêm khoảng rảnh tuần
            </button>
          </>
        )}
        {value.mode === "slots" && (
          <>
            {value.preferredSlots.map((slot, index) => (
              <fieldset key={slot.clientId} className="learner-picker">
                <legend>Khoảng ngày giờ {index + 1}</legend>
                {(["startAt", "endAt"] as const).map((field) => (
                  <label key={field}>
                    <span>{field === "startAt" ? "Bắt đầu" : "Kết thúc"}</span>
                    <input
                      required
                      type="datetime-local"
                      value={slot[field]}
                      onChange={(e) =>
                        change({
                          preferredSlots: value.preferredSlots.map((item, i) =>
                            i === index
                              ? { ...item, [field]: e.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    change({
                      preferredSlots: value.preferredSlots.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  Bỏ ngày giờ {index + 1}
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              className="btn"
              disabled={value.preferredSlots.length >= 5}
              onClick={() =>
                change({
                  preferredSlots: [
                    ...value.preferredSlots,
                    { clientId: crypto.randomUUID(), startAt: "", endAt: "" },
                  ],
                })
              }
            >
              Thêm ngày giờ cụ thể
            </button>
          </>
        )}
      </fieldset>
      <label>
        <span>
          <input
            type="checkbox"
            checked={value.verifiedTeacherOnly}
            disabled={disabled}
            onChange={(e) => change({ verifiedTeacherOnly: e.target.checked })}
          />{" "}
          Chỉ nhận người có kỹ năng hướng dẫn đã được xác minh
        </span>
      </label>
      <label>
        <span>Hết hạn mong muốn (giờ Việt Nam, không bắt buộc)</span>
        <input
          type="datetime-local"
          value={value.expiresAt}
          disabled={disabled}
          onChange={(e) => change({ expiresAt: e.target.value })}
        />
        <small>
          Để trống để dùng thời hạn mặc định của hệ thống. Bài hết hạn không
          nhận lời đề nghị mới.
        </small>
      </label>
    </>
  );
}
