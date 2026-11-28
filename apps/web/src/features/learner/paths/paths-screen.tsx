"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import {
  splitPages,
  useListPages,
} from "@/components/pagination/use-list-pages";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUserList } from "../hooks/use-user-resource";
import type { PathSummary } from "../types";
import {
  Feedback,
  PageHeading,
  Status,
  formatTime,
} from "../components/common";
import { MemberIdentity } from "../components/member-identity";
import { ProductIcon } from "../components/product-icon";
import { ProfileName } from "../components/profile-name";
import type { PathOverview } from "./path-overview";
import { learningStageLabel, pathActionLabel } from "./path-navigation";
import styles from "./paths-screen.module.css";

type PathItem = PathSummary & Partial<PathOverview>;

type QuickGroup =
  "" | "ATTENTION" | "IN_PROGRESS" | "SETUP" | "DONE" | "STOPPED";

const SETUP_STATUSES = new Set([
  "PROPOSED",
  "PARTIALLY_CONFIRMED",
  "CONFIRMED",
]);
const ACTIVE_STATUSES = new Set(["SCHEDULED", "ACTIVE"]);

const statusOptions: readonly [string, string][] = [
  ["PROPOSED", "Đang đề xuất"],
  ["PARTIALLY_CONFIRMED", "Chờ bên còn lại xác nhận"],
  ["CONFIRMED", "Đã xác nhận thỏa thuận"],
  ["SCHEDULED", "Đã chốt lịch học"],
  ["ACTIVE", "Đang diễn ra"],
  ["DISPUTED", "Đang tranh chấp"],
  ["COMPLETED", "Đã hoàn thành"],
  ["CANCELLED", "Đã hủy / dừng"],
];

const exchangeLabels: Record<string, string> = {
  TWO_WAY: "Trao đổi 2 chiều",
  ONE_WAY: "Hướng dẫn 1 chiều",
};

function needsAttention(path: PathItem) {
  return (path.attentionCount ?? 0) > 0 || path.status === "DISPUTED";
}

function matchesQuickGroup(path: PathItem, group: QuickGroup) {
  if (!group) return true;
  if (group === "ATTENTION") return needsAttention(path);
  if (group === "IN_PROGRESS") return ACTIVE_STATUSES.has(path.status);
  if (group === "SETUP") return SETUP_STATUSES.has(path.status);
  if (group === "DONE") return path.status === "COMPLETED";
  return path.status === "CANCELLED";
}

function progressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function cardVariantClass(path: PathItem) {
  if (path.status === "DISPUTED") return ` ${styles.cardDisputed}`;
  if ((path.attentionCount ?? 0) > 0) return ` ${styles.cardAttention}`;
  if (path.status === "COMPLETED") return ` ${styles.cardCompleted}`;
  return "";
}

function setupStageHint(status: string) {
  if (status === "PROPOSED")
    return "Đang đề xuất điều khoản. Mở lộ trình để hai bên xác nhận và lên kế hoạch.";
  if (status === "PARTIALLY_CONFIRMED")
    return "Một bên đã xác nhận điều khoản. Chờ bên còn lại hoàn tất để chuyển bước.";
  if (status === "CONFIRMED")
    return "Thỏa thuận đã xác nhận. Tiếp tục thống nhất kế hoạch và chốt lịch học.";
  return null;
}

function PathCardProgress({ path }: Readonly<{ path: PathItem }>) {
  const learning = path.progress?.learning ?? null;
  const teaching = path.progress?.teaching ?? null;
  const nextSession = path.nextSession ?? null;
  const hint = setupStageHint(path.status);

  if (!learning && !teaching && !nextSession) {
    if (!hint) return null;
    return (
      <div className={styles.setupHint}>
        <ProductIcon name="book" size={16} />
        <span>{hint}</span>
      </div>
    );
  }

  return (
    <div className={styles.progressBox}>
      {learning && (
        <div className={styles.progressItem}>
          <div className={styles.progressHeader}>
            <span>Bạn học</span>
            <strong>
              {learning.completed}/{learning.total} buổi (
              {progressPercent(learning.completed, learning.total)}%)
            </strong>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <span
              className={styles.progressFillLearn}
              style={{
                width: `${progressPercent(learning.completed, learning.total)}%`,
              }}
            />
          </div>
        </div>
      )}
      {teaching && (
        <div className={styles.progressItem}>
          <div className={styles.progressHeader}>
            <span>Bạn hướng dẫn</span>
            <strong>
              {teaching.completed}/{teaching.total} buổi (
              {progressPercent(teaching.completed, teaching.total)}%)
            </strong>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <span
              className={styles.progressFillTeach}
              style={{
                width: `${progressPercent(teaching.completed, teaching.total)}%`,
              }}
            />
          </div>
        </div>
      )}
      {nextSession && (
        <Link
          href={`/learn/sessions/${nextSession.id}`}
          className={styles.nextSessionLink}
        >
          <span className={styles.nextSessionLeft}>
            <ProductIcon name="calendar" size={15} />
            <span>Buổi tiếp theo: {formatTime(nextSession.startAt)}</span>
          </span>
          <ProductIcon name="chevron" size={15} />
        </Link>
      )}
    </div>
  );
}

function PathCard({ path }: Readonly<{ path: PathItem }>) {
  const attention = path.attentionCount ?? 0;
  const hasTitle = Boolean(path.title?.trim());
  const updatedAt = path.lastActivityAt || path.updatedAt;
  const isTwoWay = path.exchangeType === "TWO_WAY";

  return (
    <article className={styles.card + cardVariantClass(path)}>
      <div className={styles.cardTop}>
        <div className={styles.cardBadges}>
          <Status
            value={path.status}
            label={learningStageLabel(path.learningStage)}
          />
          <span
            className="exchange-pill"
            data-type={path.exchangeType ?? undefined}
          >
            <ProductIcon name={isTwoWay ? "users" : "user"} size={13} />
            {exchangeLabels[path.exchangeType ?? ""] ?? "Đang thống nhất"}
          </span>
        </div>
        {attention > 0 && (
          <span className={styles.attentionBadge}>
            <ProductIcon name="notification" size={13} />
            {attention} việc cần xử lý
          </span>
        )}
      </div>

      <div className={styles.cardHeading}>
        <h2 className={styles.cardTitle}>
          <Link href={`/learn/paths/${path.id}`}>
            {hasTitle ? (
              path.title!.trim()
            ) : (
              <>
                Học cùng <ProfileName id={path.counterpartId} />
              </>
            )}
          </Link>
        </h2>
        <div className={styles.partnerRow}>
          <MemberIdentity
            id={path.counterpartId}
            description={
              isTwoWay ? "Đối tác trao đổi 2 chiều" : "Đối tác học tập"
            }
            small
          />
        </div>
      </div>

      <PathCardProgress path={path} />

      <div className={styles.cardFooter}>
        {updatedAt ? (
          <span className={styles.updatedMeta}>
            <ProductIcon name="clock" size={14} />
            Cập nhật {formatTime(updatedAt)}
          </span>
        ) : (
          <span />
        )}
        <Link
          className={`btn btn-primary ${styles.cardCta}`}
          href={`/learn/paths/${path.id}`}
        >
          {pathActionLabel(path.learningStage, attention)}
          <ProductIcon name="arrow" size={15} />
        </Link>
      </div>
    </article>
  );
}

export function PathsScreen() {
  const [quickGroup, setQuickGroup] = useState<QuickGroup>("");
  const [exactStatus, setExactStatus] = useState("");
  const list = useUserList<PathItem>("learning-paths/mine?limit=20");
  const { cursor, loading, error, more } = list;
  const filtered = Boolean(quickGroup || exactStatus);

  useEffect(() => {
    if (filtered && cursor && !loading && !error) void more();
  }, [filtered, cursor, loading, error, more]);

  const filteredItems = filtered
    ? list.items.filter((row) =>
        exactStatus
          ? row.status === exactStatus
          : matchesQuickGroup(row, quickGroup),
      )
    : list.items;

  const pagination = useListPages({
    ...list,
    scope: `${list.scope}:${quickGroup}:${exactStatus}`,
    chunks: filtered ? splitPages(filteredItems) : list.chunks,
    loading: loading || (filtered && !!cursor && !error),
    hasMore: !filtered && !!cursor,
  });
  const query = { ...list, ...pagination, allItems: list.items };

  const counts = {
    all: list.items.length,
    inProgress: list.items.filter((row) => ACTIVE_STATUSES.has(row.status))
      .length,
    setup: list.items.filter((row) => SETUP_STATUSES.has(row.status)).length,
    attention: list.items.filter((row) => needsAttention(row)).length,
    done: list.items.filter((row) => row.status === "COMPLETED").length,
  };
  const suffix = cursor ? "+" : "";

  function selectGroup(group: QuickGroup) {
    setExactStatus("");
    setQuickGroup((current) => (current === group ? "" : group));
  }

  function resetFilters() {
    setQuickGroup("");
    setExactStatus("");
  }

  const quickTabs: readonly {
    key: QuickGroup;
    label: string;
    count?: number;
  }[] = [
    { key: "", label: "Tất cả", count: counts.all },
    { key: "ATTENTION", label: "Cần chú ý", count: counts.attention },
    { key: "IN_PROGRESS", label: "Đang học", count: counts.inProgress },
    { key: "SETUP", label: "Đang thiết lập", count: counts.setup },
    { key: "DONE", label: "Hoàn thành", count: counts.done },
    { key: "STOPPED", label: "Đã dừng" },
  ];

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="Học & Dạy 1:1"
        title="Lộ trình học của tôi"
        description="Theo dõi thỏa thuận học tập, kế hoạch từng buổi, lịch học 1:1 và trạng thái quyết toán Credit rõ ràng tại một nơi."
        action={
          <Link className="btn btn-primary" href="/learn/messages">
            <ProductIcon name="chat" size={16} />
            Tin nhắn thương lượng
          </Link>
        }
      />

      {list.items.length > 0 && (
        <section
          className={styles.summaryStrip}
          aria-label="Tổng quan nhanh các lộ trình"
        >
          <button
            type="button"
            className={
              styles.summaryTile +
              (quickGroup === "IN_PROGRESS" && !exactStatus
                ? ` ${styles.summaryTileActive}`
                : "")
            }
            aria-pressed={quickGroup === "IN_PROGRESS" && !exactStatus}
            onClick={() => selectGroup("IN_PROGRESS")}
          >
            <span className={`${styles.summaryIcon} ${styles.iconSage}`}>
              <ProductIcon name="calendar" size={19} />
            </span>
            <span className={styles.summaryCopy}>
              <small>Đang học / đã chốt lịch</small>
              <strong>
                {counts.inProgress}
                {suffix}
              </strong>
            </span>
          </button>

          <button
            type="button"
            className={
              styles.summaryTile +
              (quickGroup === "SETUP" && !exactStatus
                ? ` ${styles.summaryTileActive}`
                : "")
            }
            aria-pressed={quickGroup === "SETUP" && !exactStatus}
            onClick={() => selectGroup("SETUP")}
          >
            <span className={`${styles.summaryIcon} ${styles.iconBrand}`}>
              <ProductIcon name="book" size={19} />
            </span>
            <span className={styles.summaryCopy}>
              <small>Đang thiết lập</small>
              <strong>
                {counts.setup}
                {suffix}
              </strong>
            </span>
          </button>

          <button
            type="button"
            className={
              styles.summaryTile +
              (counts.attention > 0 ? ` ${styles.summaryTileAlert}` : "") +
              (quickGroup === "ATTENTION" && !exactStatus
                ? ` ${styles.summaryTileActive}`
                : "")
            }
            aria-pressed={quickGroup === "ATTENTION" && !exactStatus}
            onClick={() => selectGroup("ATTENTION")}
          >
            <span className={`${styles.summaryIcon} ${styles.iconWarn}`}>
              <ProductIcon name="notification" size={19} />
            </span>
            <span className={styles.summaryCopy}>
              <small>Cần chú ý</small>
              <strong>
                {counts.attention}
                {suffix}
              </strong>
            </span>
          </button>

          <button
            type="button"
            className={
              styles.summaryTile +
              (quickGroup === "DONE" && !exactStatus
                ? ` ${styles.summaryTileActive}`
                : "")
            }
            aria-pressed={quickGroup === "DONE" && !exactStatus}
            onClick={() => selectGroup("DONE")}
          >
            <span className={`${styles.summaryIcon} ${styles.iconOk}`}>
              <ProductIcon name="check" size={19} />
            </span>
            <span className={styles.summaryCopy}>
              <small>Đã hoàn thành</small>
              <strong>
                {counts.done}
                {suffix}
              </strong>
            </span>
          </button>
        </section>
      )}

      <section className={styles.toolbar} aria-label="Bộ lọc lộ trình">
        <div className={styles.chipTrack} role="group" aria-label="Lọc nhanh">
          {quickTabs.map((item) => {
            const active = !exactStatus && quickGroup === item.key;
            return (
              <button
                key={item.key || "ALL"}
                type="button"
                className={
                  styles.chip + (active ? ` ${styles.chipActive}` : "")
                }
                aria-pressed={active}
                onClick={() => {
                  setExactStatus("");
                  setQuickGroup(item.key);
                }}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className={styles.chipCount}>
                    {item.count}
                    {suffix}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className={styles.selectGroup}>
          <label className={styles.selectLabel}>
            <ProductIcon name="filter" size={15} />
            <span className={styles.srOnly}>Trạng thái chi tiết</span>
            <select
              className={styles.selectControl}
              aria-label="Lọc theo trạng thái chi tiết"
              value={exactStatus}
              onChange={(event) => {
                setQuickGroup("");
                setExactStatus(event.target.value);
              }}
            >
              <option value="">Trạng thái chi tiết</option>
              {statusOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {filtered && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={resetFilters}
            >
              Xóa lọc
            </button>
          )}
        </div>
      </section>

      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />

      {query.items.length > 0 && (
        <div className={styles.grid}>
          {query.items.map((path) => (
            <PathCard key={path.id} path={path} />
          ))}
        </div>
      )}

      {!query.loading && !query.error && !query.items.length && (
        <div className={styles.emptyState}>
          <span className={styles.emptyEmblem}>
            <ProductIcon name={filtered ? "filter" : "book"} size={24} />
          </span>
          <h2>
            {filtered
              ? "Không có lộ trình phù hợp bộ lọc"
              : "Bạn chưa có lộ trình học nào"}
          </h2>
          <p>
            {filtered
              ? "Thử chuyển sang nhóm trạng thái khác hoặc xóa bộ lọc để xem toàn bộ lộ trình của bạn."
              : "Khám phá bài đăng kỹ năng hoặc mở cuộc trao đổi trong Tin nhắn để tạo thỏa thuận học đầu tiên."}
          </p>
          <div className={styles.emptyActions}>
            {filtered ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={resetFilters}
              >
                Xem tất cả lộ trình
              </button>
            ) : (
              <>
                <Link className="btn btn-primary" href="/learn/explore">
                  <ProductIcon name="search" size={16} />
                  Khám phá cộng đồng
                </Link>
                <Link className="btn" href="/learn/messages">
                  <ProductIcon name="chat" size={16} />
                  Mở tin nhắn
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <ListPagination query={query} />
    </div>
  );
}
