"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import {
  splitPages,
  useListPages,
} from "@/components/pagination/use-list-pages";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Feedback, PageHeading } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { useUserList } from "../hooks/use-user-resource";
import type { SharingSkill } from "../types";
import { AddSkillDrawer } from "./add-skill-drawer";
import { SkillManagementCard } from "./skill-management-card";
import {
  skillLevelDisplay,
  verificationStatusLabel,
} from "./skill-presentation";
import styles from "./skills-screen.module.css";

type SkillTab = "ALL" | "ACTIVE" | "ARCHIVED";
type VerificationFilter =
  "" | "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
type VisibilityFilter = "" | "VISIBLE" | "HIDDEN";

const tabOptions: readonly {
  value: SkillTab;
  label: string;
  hint: string;
  dotClass: string;
}[] = [
  {
    value: "ALL",
    label: "Tất cả",
    hint: "Toàn bộ kỹ năng chia sẻ của bạn, bao gồm cả mục đã lưu trữ.",
    dotClass: styles.dotAll ?? "",
  },
  {
    value: "ACTIVE",
    label: "Đang hoạt động",
    hint: "Các kỹ năng có thể bật hiển thị công khai và nhận lời mời học 1:1.",
    dotClass: styles.dotActive ?? "",
  },
  {
    value: "ARCHIVED",
    label: "Đã lưu trữ",
    hint: "Kỹ năng tạm ngừng chia sẻ. Lịch sử và xác minh cũ vẫn được giữ nguyên.",
    dotClass: styles.dotArchived ?? "",
  },
];

function emptyStateCopy(
  tab: SkillTab,
  hasFilters: boolean,
): { title: string; description: string } {
  if (hasFilters) {
    return {
      title: "Không tìm thấy kỹ năng phù hợp",
      description:
        "Thử thay đổi từ khóa tìm kiếm, trạng thái xác minh hoặc xóa bộ lọc đang áp dụng để xem lại danh sách.",
    };
  }
  if (tab === "ARCHIVED") {
    return {
      title: "Bạn chưa có kỹ năng nào được lưu trữ",
      description:
        "Khi bạn tạm ngừng chia sẻ một kỹ năng, mục đó sẽ xuất hiện tại đây và có thể khôi phục bất cứ lúc nào.",
    };
  }
  return {
    title: "Bạn chưa khai báo kỹ năng chia sẻ",
    description:
      "Thêm kỹ năng bạn tự tin hướng dẫn từ danh mục chuẩn để xuất hiện trong kết quả tìm kiếm và bắt đầu nhận đề nghị học 1:1.",
  };
}

export function SkillsScreen() {
  const [tab, setTab] = useState<SkillTab>("ALL");
  const [verification, setVerification] = useState<VerificationFilter>("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("");
  const [searchText, setSearchText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [createdSkill, setCreatedSkill] = useState<SharingSkill | null>(null);

  const list = useUserList<SharingSkill>(
    "me/skills?limit=20&includeArchived=true",
  );
  const { cursor, loading, error, more } = list;

  const normalizedSearch = searchText.trim().toLocaleLowerCase("vi");
  const archivedOnly = tab === "ARCHIVED";
  const effectiveVisibility = archivedOnly ? "" : visibility;
  const hasDetailFilters = Boolean(
    verification || effectiveVisibility || normalizedSearch,
  );
  const filtered = tab !== "ALL" || hasDetailFilters;
  const loadingRemaining = filtered && !!cursor && !error;

  // The API exposes inclusion, not an archived-only or verification filter.
  // Read the remaining pages before reporting an empty result or final page count.
  useEffect(() => {
    if (filtered && cursor && !loading && !error) void more();
  }, [filtered, cursor, loading, error, more]);

  const filteredItems = useMemo(() => {
    if (!filtered) return list.items;
    return list.items.filter((skill) => {
      if (tab === "ARCHIVED" && skill.archivedAt === null) return false;
      if (tab === "ACTIVE" && skill.archivedAt !== null) return false;
      if (
        verification &&
        (skill.verificationStatus ?? "UNVERIFIED") !== verification
      ) {
        return false;
      }
      if (
        effectiveVisibility === "VISIBLE" &&
        (!skill.isVisible || skill.archivedAt !== null)
      ) {
        return false;
      }
      if (
        effectiveVisibility === "HIDDEN" &&
        (skill.isVisible || skill.archivedAt !== null)
      ) {
        return false;
      }
      if (normalizedSearch) {
        const haystack = [
          skill.skill.name,
          skillLevelDisplay(skill),
          skill.description,
          verificationStatusLabel(skill.verificationStatus),
        ]
          .join(" ")
          .toLocaleLowerCase("vi");
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [
    filtered,
    list.items,
    tab,
    verification,
    effectiveVisibility,
    normalizedSearch,
  ]);

  const pagination = useListPages({
    ...list,
    scope: `${list.scope}:${tab}:${verification}:${effectiveVisibility}:${normalizedSearch}`,
    chunks: filtered ? splitPages(filteredItems) : list.chunks,
    loading: list.loading || loadingRemaining,
    hasMore: !filtered && !!list.cursor,
  });
  const query = { ...list, ...pagination };

  const stats = useMemo(() => {
    let active = 0;
    let archived = 0;
    let verifiedActive = 0;
    let pendingActive = 0;
    let visibleActive = 0;
    const activeIds = new Set<string>();
    const archivedIds = new Set<string>();

    for (const item of list.items) {
      if (item.archivedAt === null) {
        active += 1;
        activeIds.add(item.skill.id);
        if (item.verificationStatus === "VERIFIED") verifiedActive += 1;
        if (item.verificationStatus === "PENDING") pendingActive += 1;
        if (item.isVisible) visibleActive += 1;
      } else {
        archived += 1;
        archivedIds.add(item.skill.id);
      }
    }

    return {
      total: list.items.length,
      active,
      archived,
      verifiedActive,
      pendingActive,
      visibleActive,
      hiddenActive: active - visibleActive,
      activeIds,
      archivedIds,
    };
  }, [list.items]);

  const countSuffix = list.cursor ? "+" : "";
  const formatCount = (value: number) =>
    list.initialLoading ? "—" : `${value}${countSuffix}`;

  function selectTab(next: SkillTab) {
    setTab(next);
    if (next === "ARCHIVED") setVisibility("");
  }

  function clearDetailFilters() {
    setSearchText("");
    setVerification("");
    setVisibility("");
  }

  const activeChips: { key: string; label: string; onRemove: () => void }[] =
    [];
  if (searchText.trim()) {
    activeChips.push({
      key: "search",
      label: `Từ khóa: “${searchText.trim()}”`,
      onRemove: () => setSearchText(""),
    });
  }
  if (verification) {
    activeChips.push({
      key: "verification",
      label: `Xác minh: ${verificationStatusLabel(verification)}`,
      onRemove: () => setVerification(""),
    });
  }
  if (effectiveVisibility) {
    activeChips.push({
      key: "visibility",
      label:
        effectiveVisibility === "VISIBLE"
          ? "Hiển thị: Công khai"
          : "Hiển thị: Đang ẩn",
      onRemove: () => setVisibility(""),
    });
  }

  const currentTabMeta =
    tabOptions.find((option) => option.value === tab) ?? tabOptions[0]!;
  const emptyInfo = emptyStateCopy(tab, hasDetailFilters);

  const tabCounts: Record<SkillTab, number> = {
    ALL: stats.total,
    ACTIVE: stats.active,
    ARCHIVED: stats.archived,
  };

  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="Năng lực chia sẻ"
        title="Kỹ năng tôi có thể chia sẻ"
        description="Thêm kỹ năng từ danh mục chuẩn để xuất hiện trong kết quả tìm kiếm. Nộp chứng chỉ để nhân sự duyệt nhãn Đã xác minh (không tự hết hạn)."
        action={
          <button
            type="button"
            className={`btn btn-primary ${styles.headerCta}`}
            onClick={() => setAddOpen(true)}
          >
            <ProductIcon name="plus" size={16} />
            Thêm kỹ năng mới
          </button>
        }
      />

      {createdSkill && (
        <div className={styles.banner} role="status">
          <div className={styles.bannerBody}>
            <span className={styles.bannerIcon} aria-hidden="true">
              <ProductIcon name="check" size={17} />
            </span>
            <div className={styles.bannerText}>
              <strong>
                Đã thêm kỹ năng “{createdSkill.skill.name}” vào hồ sơ chia sẻ
              </strong>
              <span>
                Bạn có thể gửi đề xuất cho bài học phù hợp hoặc nộp chứng chỉ để
                nhận nhãn Đã xác minh.
              </span>
            </div>
          </div>
          <div className={styles.bannerActions}>
            <Link
              className="btn btn-sm btn-primary"
              href={`/learn/skills/${createdSkill.id}/verification`}
            >
              <ProductIcon name="shield" size={14} />
              Nộp xác minh ngay
            </Link>
            <button
              type="button"
              className={styles.bannerDismiss}
              onClick={() => setCreatedSkill(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      <section
        className={styles.statsGrid}
        aria-label="Tổng quan kỹ năng chia sẻ"
      >
        <button
          type="button"
          className={
            styles.statTile +
            (tab === "ACTIVE" && !verification && !effectiveVisibility
              ? ` ${styles.statTileActive}`
              : "")
          }
          onClick={() => {
            setTab("ACTIVE");
            setVerification("");
            setVisibility("");
          }}
        >
          <span
            className={`${styles.statIcon} ${styles.statIconSage}`}
            aria-hidden="true"
          >
            <ProductIcon name="book" size={19} />
          </span>
          <span className={styles.statContent}>
            <span className={styles.statLabel}>Đang hoạt động</span>
            <strong className={styles.statValue}>
              {formatCount(stats.active)}
            </strong>
            <span className={styles.statHint}>
              {stats.visibleActive > 0
                ? `${stats.visibleActive} đang công khai`
                : "Sẵn sàng nhận lời mời"}
            </span>
          </span>
        </button>

        <button
          type="button"
          className={
            styles.statTile +
            (tab === "ACTIVE" && verification === "VERIFIED"
              ? ` ${styles.statTileActive}`
              : "")
          }
          onClick={() => {
            setTab("ACTIVE");
            setVerification("VERIFIED");
            setVisibility("");
          }}
        >
          <span
            className={`${styles.statIcon} ${styles.statIconOk}`}
            aria-hidden="true"
          >
            <ProductIcon name="shield" size={19} />
          </span>
          <span className={styles.statContent}>
            <span className={styles.statLabel}>Đã xác minh</span>
            <strong className={styles.statValue}>
              {formatCount(stats.verifiedActive)}
            </strong>
            <span className={styles.statHint}>
              {stats.pendingActive > 0
                ? `${stats.pendingActive} đang chờ duyệt`
                : "Nhãn uy tín vĩnh viễn"}
            </span>
          </span>
        </button>

        <button
          type="button"
          className={
            styles.statTile +
            (tab === "ACTIVE" && effectiveVisibility === "VISIBLE"
              ? ` ${styles.statTileActive}`
              : "")
          }
          onClick={() => {
            setTab("ACTIVE");
            setVerification("");
            setVisibility("VISIBLE");
          }}
        >
          <span
            className={`${styles.statIcon} ${styles.statIconBrand}`}
            aria-hidden="true"
          >
            <ProductIcon name="eye" size={19} />
          </span>
          <span className={styles.statContent}>
            <span className={styles.statLabel}>Đang công khai</span>
            <strong className={styles.statValue}>
              {formatCount(stats.visibleActive)}
            </strong>
            <span className={styles.statHint}>
              {stats.hiddenActive > 0
                ? `${stats.hiddenActive} kỹ năng đang ẩn`
                : "Hiện trong tìm kiếm"}
            </span>
          </span>
        </button>

        <button
          type="button"
          className={
            styles.statTile +
            (tab === "ARCHIVED" ? ` ${styles.statTileActive}` : "")
          }
          onClick={() => {
            setTab("ARCHIVED");
            setVerification("");
            setVisibility("");
          }}
        >
          <span
            className={`${styles.statIcon} ${styles.statIconNeutral}`}
            aria-hidden="true"
          >
            <ProductIcon name="archive" size={19} />
          </span>
          <span className={styles.statContent}>
            <span className={styles.statLabel}>Đã lưu trữ</span>
            <strong className={styles.statValue}>
              {formatCount(stats.archived)}
            </strong>
            <span className={styles.statHint}>Có thể khôi phục</span>
          </span>
        </button>
      </section>

      <section
        className={styles.controlCard}
        aria-label="Lọc và tìm kiếm kỹ năng của tôi"
      >
        <div className={styles.statusSection}>
          <div
            className={styles.statusTrack}
            role="group"
            aria-label="Trạng thái kỹ năng"
          >
            {tabOptions.map((option) => {
              const active = tab === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={
                    styles.statusPill +
                    (active ? ` ${styles.statusPillActive}` : "")
                  }
                  aria-pressed={active}
                  onClick={() => selectTab(option.value)}
                >
                  <span
                    className={`${styles.statusDot} ${option.dotClass}`}
                    aria-hidden="true"
                  />
                  <span>{option.label}</span>
                  {!list.initialLoading && (
                    <span className={styles.pillCount}>
                      {tabCounts[option.value]}
                      {countSuffix}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.toolbarRow}>
          <div className={styles.searchField}>
            <ProductIcon name="search" size={17} />
            <input
              type="search"
              className={styles.searchInput}
              aria-label="Tìm trong kỹ năng của tôi"
              placeholder="Tìm theo tên kỹ năng, trình độ hoặc mô tả…"
              value={searchText}
              maxLength={100}
              onChange={(event) => setSearchText(event.target.value)}
            />
            {searchText && (
              <button
                type="button"
                className={styles.searchClear}
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => setSearchText("")}
              >
                <ProductIcon name="close" size={15} />
              </button>
            )}
          </div>

          <div className={styles.filterControls}>
            <select
              className={styles.quickSelect}
              aria-label="Lọc theo trạng thái xác minh"
              value={verification}
              onChange={(event) =>
                setVerification(event.target.value as VerificationFilter)
              }
            >
              <option value="">Tất cả xác minh</option>
              <option value="VERIFIED">Đã xác minh</option>
              <option value="PENDING">Chờ duyệt xác minh</option>
              <option value="UNVERIFIED">Chưa xác minh</option>
              <option value="REJECTED">Bị từ chối</option>
            </select>

            {!archivedOnly && (
              <select
                className={styles.quickSelect}
                aria-label="Lọc theo trạng thái hiển thị"
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as VisibilityFilter)
                }
              >
                <option value="">Mọi hiển thị</option>
                <option value="VISIBLE">Đang hiển thị</option>
                <option value="HIDDEN">Đang ẩn</option>
              </select>
            )}

            {hasDetailFilters && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={clearDetailFilters}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className={styles.activeBar} aria-label="Bộ lọc đang áp dụng">
            <span className={styles.activeLabel}>Đang lọc:</span>
            {activeChips.map((chip) => (
              <span key={chip.key} className={styles.activeChip}>
                <span className={styles.activeChipText}>{chip.label}</span>
                <button
                  type="button"
                  className={styles.activeChipRemove}
                  aria-label={`Bỏ lọc ${chip.label}`}
                  onClick={chip.onRemove}
                >
                  <ProductIcon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className={styles.resultsBar}>
        <span>
          <strong>{currentTabMeta.label}</strong>
          {!query.initialLoading && !query.error && (
            <>
              {" "}
              ·{" "}
              {query.items.length > 0
                ? `${filtered ? filteredItems.length : query.items.length}${
                    !filtered && query.hasNext ? "+" : ""
                  } kỹ năng${
                    query.pageNumber > 1 ? ` (trang ${query.pageNumber})` : ""
                  }`
                : "Chưa có kỹ năng"}
            </>
          )}
        </span>
        <span>{currentTabMeta.hint}</span>
      </div>

      <Feedback
        loading={
          query.initialLoading || (loadingRemaining && !query.items.length)
        }
        error={query.error}
        reload={query.reload}
        refreshing={
          !!(
            query.loading &&
            !(query.initialLoading || (loadingRemaining && !query.items.length))
          )
        }
      />

      {query.items.length > 0 && (
        <div className={styles.skillGrid}>
          {query.items.map((skill) => (
            <SkillManagementCard
              key={skill.id}
              skill={skill}
              blocked={!!query.error || query.loading}
              reload={query.reload}
            />
          ))}
        </div>
      )}

      {!query.loading && !query.error && !query.items.length && (
        <div className={styles.emptyState}>
          <span className={styles.emptyEmblem} aria-hidden="true">
            <ProductIcon
              name={
                hasDetailFilters ? "search" : archivedOnly ? "archive" : "award"
              }
              size={24}
            />
          </span>
          <h2>{emptyInfo.title}</h2>
          <p>{emptyInfo.description}</p>
          <div className={styles.emptyActions}>
            {hasDetailFilters ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={clearDetailFilters}
              >
                Xóa bộ lọc
              </button>
            ) : archivedOnly ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => selectTab("ACTIVE")}
              >
                Xem kỹ năng đang hoạt động
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAddOpen(true)}
              >
                <ProductIcon name="plus" size={16} />
                Thêm kỹ năng đầu tiên
              </button>
            )}
            {tab !== "ALL" && hasDetailFilters && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setTab("ALL");
                  clearDetailFilters();
                }}
              >
                Xem tất cả kỹ năng
              </button>
            )}
          </div>
        </div>
      )}

      <ListPagination query={query} />

      <AddSkillDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(created) => {
          setAddOpen(false);
          setCreatedSkill(created);
          setTab((current) => (current === "ARCHIVED" ? "ALL" : current));
          query.reload();
        }}
        activeSkillIds={stats.activeIds}
        archivedSkillIds={stats.archivedIds}
      />
    </div>
  );
}
