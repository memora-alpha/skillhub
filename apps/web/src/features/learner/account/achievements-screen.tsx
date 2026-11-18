"use client";
import { LoadingButton } from "@/components/loading-button";
import { achievementCopy, achievementTitle } from "@/lib/i18n/system-copy";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserSession } from "../auth/session";
import {
  Back,
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  formatTime,
} from "../components/common";
import { ProductIcon } from "../components/product-icon";
import "./achievements.css";

type Achievements = {
  selectedTitle: string | null;
  items: {
    code: string;
    title: string;
    description: string;
    unlockedAt: string;
  }[];
};

export function AchievementsScreen() {
  const query = useUserResource<Achievements>("me/achievements");
  const { request } = useUserSession();
  const command = useUserCommand();
  const data = query.data;
  async function select(code: string | null) {
    const result = await command.run("title:" + code, () =>
      request("me/achievements/selected-title", {
        method: "PATCH",
        body: code === null ? {} : { code },
      }),
    );
    if (result) query.reload();
  }
  return (
    <>
      <Back href="/learn/profile" />
      <PageHeading title="Thành tích & danh hiệu" />
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      <CommandFeedback command={command} />
      {data && (
        <>
          <Panel title="Danh hiệu trên hồ sơ">
            <p>
              {achievementTitle(data.selectedTitle) ??
                "Bạn chưa chọn danh hiệu."}
            </p>
            {data.selectedTitle && (
              <LoadingButton
                type="button"
                className="btn"
                disabled={command.pending || command.uncertain}
                onClick={() => {
                  void select(null);
                }}
                loading={!!command.pending}
              >
                Bỏ chọn danh hiệu
              </LoadingButton>
            )}
          </Panel>
          <div className="achievement-grid">
            {data.items.map((item) => (
              <Panel key={item.code} className="achievement-card">
                <span className="achievement-emblem">
                  <ProductIcon name="award" />
                </span>
                <h2>{achievementCopy(item).title}</h2>
                <p>{achievementCopy(item).description}</p>
                <p className="muted">Mở khóa: {formatTime(item.unlockedAt)}</p>
                <LoadingButton
                  type="button"
                  className="btn"
                  disabled={
                    data.selectedTitle === item.title ||
                    command.pending ||
                    command.uncertain
                  }
                  onClick={() => {
                    void select(item.code);
                  }}
                  loading={!!command.pending}
                >
                  {data.selectedTitle === item.title
                    ? "Đang dùng trên hồ sơ"
                    : "Dùng danh hiệu này"}
                </LoadingButton>
              </Panel>
            ))}
          </div>
          {!data.items.length && (
            <Empty>
              Chưa có thành tích được mở khóa. Hoàn thành lộ trình, chia sẻ kỹ
              năng và xác minh kỹ năng để nhận thành tích khi đủ điều kiện.
            </Empty>
          )}
        </>
      )}
    </>
  );
}
