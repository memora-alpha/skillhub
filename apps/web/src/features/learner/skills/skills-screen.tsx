"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import {
  splitPages,
  useListPages,
} from "@/components/pagination/use-list-pages";
import { formText } from "../components/form-data";

import { useEffect, useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import type { SharingSkill } from "../types";
import { SkillPicker } from "../components/skill-picker";
import {
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
} from "../components/common";
import { SkillManagementCard } from "./skill-management-card";
type Level = {
  id: string;
  name: string;
  code: string;
  status: string;
  sortOrder: number;
};
export function SkillsScreen() {
  const [tab, setTab] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [verification, setVerification] = useState("");
  const list = useUserList<SharingSkill>(
    "me/skills?limit=20&includeArchived=true",
  );
  const { cursor, loading, error, more } = list;
  const archivedOnly = tab === "ARCHIVED";
  const filtered = tab !== "ALL" || !!verification;
  const loadingArchived = filtered && !!cursor && !error;
  // The API exposes inclusion, not an archived-only filter. Read the remaining
  // pages before reporting an empty archive or its final page count.
  useEffect(() => {
    if (filtered && cursor && !loading && !error) void more();
  }, [filtered, cursor, loading, error, more]);
  const pagination = useListPages({
    ...list,
    scope: `${list.scope}:${tab}:${verification}`,
    chunks: filtered
      ? splitPages(
          list.items.filter(
            (skill) =>
              (tab === "ALL" ||
                (archivedOnly
                  ? skill.archivedAt !== null
                  : skill.archivedAt === null)) &&
              (!verification || skill.verificationStatus === verification),
          ),
        )
      : list.chunks,
    loading: list.loading || loadingArchived,
    hasMore: !filtered && !!list.cursor,
  });
  const query = { ...list, ...pagination },
    { request } = useUserSession(),
    command = useUserCommand(true);
  const [skillId, setSkillId] = useState(""),
    [message, setMessage] = useState<string>();
  const levels = useUserResource<Level[]>(
    skillId ? "skills/" + skillId + "/levels" : null,
  );
  return (
    <>
      <PageHeading
        eyebrow="Năng lực chia sẻ"
        title="Kỹ năng tôi có thể chia sẻ"
        description="Thêm kỹ năng từ danh mục chuẩn để xuất hiện trong kết quả tìm kiếm. Nộp chứng chỉ để nhân sự duyệt nhãn Đã xác minh (không tự hết hạn)."
      />
      <fieldset className="learner-tabs" aria-label="Lọc kỹ năng">
        <button
          type="button"
          aria-pressed={tab === "ALL"}
          onClick={() => setTab("ALL")}
        >
          Tất cả
        </button>
        <button
          type="button"
          aria-pressed={archivedOnly}
          onClick={() => setTab("ARCHIVED")}
        >
          Đã lưu trữ
        </button>
        <button
          type="button"
          aria-pressed={tab === "ACTIVE"}
          onClick={() => setTab("ACTIVE")}
        >
          Đang hoạt động
        </button>
      </fieldset>
      <label>
        Xác minh
        <select
          value={verification}
          onChange={(event) => setVerification(event.target.value)}
        >
          <option value="">Tất cả</option>
          <option value="UNVERIFIED">Chưa xác minh</option>
          <option value="PENDING">Đang chờ</option>
          <option value="VERIFIED">Đã xác minh</option>
          <option value="REJECTED">Bị từ chối</option>
        </select>
      </label>
      <div className="learner-two-columns">
        <div className="learner-stack">
          <Feedback
            loading={
              query.initialLoading || (loadingArchived && !query.items.length)
            }
            error={query.error}
            reload={query.reload}
            refreshing={
              !!(
                query.loading &&
                !(
                  query.initialLoading ||
                  (loadingArchived && !query.items.length)
                )
              )
            }
          />
          {query.items.map((skill) => (
            <SkillManagementCard
              key={skill.id}
              skill={skill}
              blocked={!!query.error || query.loading}
              reload={query.reload}
            />
          ))}
          {!query.loading && !query.error && !query.items.length && (
            <Empty>
              {archivedOnly
                ? "Bạn chưa có kỹ năng nào được lưu trữ."
                : "Bạn chưa khai báo kỹ năng chia sẻ."}
            </Empty>
          )}
          <ListPagination query={query} />
        </div>
        <Panel title="Thêm kỹ năng">
          <form
            className="learner-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const experienceYears = formText(data, "experienceYears").trim();
              const body = {
                skillId,
                levelId: formText(data, "levelId"),
                description: formText(data, "description").trim(),
                ...(experienceYears ? { experienceYears } : {}),
                isVisible: data.get("isVisible") === "on",
              };
              const result = await command.run(JSON.stringify(body), (key) =>
                request("me/skills", { method: "POST", key, body }),
              );
              if (result) {
                form.reset();
                setSkillId("");
                setMessage(
                  "Đã thêm kỹ năng. Bạn có thể gửi đề xuất cho bài học phù hợp.",
                );
                query.reload();
              }
            }}
          >
            <SkillPicker
              value={skillId}
              onChange={setSkillId}
              disabled={command.pending || command.uncertain}
            />
            <Feedback
              variant="inline"
              loading={levels.initialLoading}
              error={levels.error}
              reload={levels.reload}
              refreshing={!!(levels.loading && !levels.initialLoading)}
            />
            <label>
              <span>Trình độ</span>
              <select
                name="levelId"
                key={skillId}
                required
                disabled={!levels.data || command.pending}
              >
                <option value="">Chọn trình độ</option>
                {levels.data
                  ?.filter((level) => level.status === "ACTIVE")
                  .sort(
                    (left, right) =>
                      left.sortOrder - right.sortOrder ||
                      left.id.localeCompare(right.id),
                  )
                  .map((level) => (
                    <option value={level.id} key={level.id}>
                      {level.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Kinh nghiệm và điều bạn có thể hướng dẫn</span>
              <textarea
                name="description"
                rows={5}
                minLength={20}
                maxLength={1500}
                required
                disabled={command.pending}
              />
            </label>
            <label>
              <span>Số năm kinh nghiệm (không bắt buộc)</span>
              <input
                name="experienceYears"
                inputMode="decimal"
                pattern="^(?:[0-5]?\d(?:\.\d)?|60(?:\.0)?)$"
                placeholder="Ví dụ: 2.5"
                disabled={command.pending}
              />
            </label>
            <label className="learner-check">
              <input
                type="checkbox"
                name="isVisible"
                defaultChecked
                disabled={command.pending}
              />
              <span>Hiển thị công khai trên hồ sơ và tìm kiếm</span>
            </label>
            <CommandFeedback command={command} />
            {message && <p className="learner-notice">{message}</p>}
            <LoadingButton
              type="submit"
              className="btn btn-primary"
              disabled={
                !skillId ||
                !levels.data ||
                command.pending ||
                (command.uncertain && !command.canRetry)
              }
              loading={!!command.pending}
            >
              Lưu kỹ năng
            </LoadingButton>
          </form>
        </Panel>
      </div>
    </>
  );
}
