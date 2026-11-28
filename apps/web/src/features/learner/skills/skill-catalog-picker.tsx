"use client";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { SearchInput } from "@/components/search-input";
import { useState } from "react";
import { Feedback, More } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import type { Skill } from "../types";
import styles from "./skills-screen.module.css";

export function SkillCatalogPicker({
  value,
  onChange,
  disabled = false,
  activeSkillIds,
  archivedSkillIds,
}: Readonly<{
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  activeSkillIds: ReadonlySet<string>;
  archivedSkillIds: ReadonlySet<string>;
}>) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");

  const normalized = search.trim().normalize("NFC");
  const shortSearchHint =
    normalized && Array.from(normalized).length < 2
      ? "Nhập thêm 1 ký tự để tìm kiếm trong danh mục."
      : undefined;

  const query = useUserList<Skill>(
    "skills?limit=20" + (term ? "&q=" + encodeURIComponent(term) : ""),
  );
  const selected = useUserResource<Skill>(value ? "skills/" + value : null);

  const selectedName =
    selected.data?.name ?? query.items.find((item) => item.id === value)?.name;

  return (
    <div className={styles.pickerBox}>
      <div className={styles.pickerHead}>
        <span className={styles.pickerTitle}>
          Chọn kỹ năng từ danh mục chuẩn *
        </span>
        {value && (
          <span className={styles.pickerSelectedTag}>
            <ProductIcon name="check" size={13} />
            <span>
              {selectedName ??
                (selected.error ? (
                  "Đã chọn kỹ năng"
                ) : (
                  <LoadingSkeleton
                    variant="inline"
                    label="Đang tải tên kỹ năng"
                  />
                ))}
            </span>
            {!disabled && (
              <button
                type="button"
                className={styles.pickerSelectedClear}
                aria-label="Bỏ chọn kỹ năng"
                onClick={() => onChange("")}
              >
                <ProductIcon name="close" size={12} />
              </button>
            )}
          </span>
        )}
      </div>

      <div className={styles.pickerSearch}>
        <ProductIcon name="search" size={16} />
        <SearchInput
          className={styles.pickerSearchInput}
          aria-label="Tìm kỹ năng trong danh mục"
          placeholder="Tìm kỹ năng (VD: React, Python, Thiết kế UI/UX…)"
          value={search}
          maxLength={100}
          disabled={disabled}
          onChange={setSearch}
          onSearch={setTerm}
          minimumLength={2}
        />
        {search && !disabled && (
          <button
            type="button"
            className={styles.searchClear}
            aria-label="Xóa từ khóa tìm kỹ năng"
            onClick={() => {
              setSearch("");
              setTerm("");
            }}
          >
            <ProductIcon name="close" size={14} />
          </button>
        )}
      </div>

      {shortSearchHint && (
        <p className={styles.pickerHint}>{shortSearchHint}</p>
      )}

      <Feedback
        variant="inline"
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />

      {!query.initialLoading && !query.error && query.items.length === 0 ? (
        <p className={styles.pickerEmpty}>
          {term
            ? `Không tìm thấy kỹ năng nào khớp với “${term}”. Thử từ khóa khác.`
            : "Danh mục kỹ năng hiện chưa có mục nào."}
        </p>
      ) : (
        <div
          className={styles.pickerList}
          role="group"
          aria-label="Danh sách kỹ năng chuẩn"
        >
          {query.items.map((skill) => {
            const isSelected = value === skill.id;
            const isOwned = activeSkillIds.has(skill.id);
            const isArchived = !isOwned && archivedSkillIds.has(skill.id);
            const chipClass = [
              styles.pickerChip,
              isSelected ? styles.pickerChipSelected : "",
              isOwned ? styles.pickerChipOwned : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={skill.id}
                type="button"
                className={chipClass}
                disabled={disabled || isOwned}
                aria-pressed={isSelected}
                onClick={() => onChange(isSelected ? "" : skill.id)}
              >
                {isSelected && <ProductIcon name="check" size={14} />}
                <span>{skill.name}</span>
                {isOwned && (
                  <span className={styles.pickerChipBadge}>Đã có</span>
                )}
                {isArchived && !isSelected && (
                  <span className={styles.pickerChipArchivedBadge}>
                    Lưu trữ
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.pickerFoot}>
        <p className={styles.pickerHint}>
          {activeSkillIds.size > 0
            ? "Kỹ năng gắn nhãn “Đã có” đang nằm trong danh sách hoạt động của bạn."
            : "Chọn 1 kỹ năng chuẩn để hệ thống hiển thị các trình độ tương ứng."}
        </p>
        <More
          cursor={query.cursor}
          loading={query.loading}
          onMore={() => {
            void query.more();
          }}
        />
      </div>
    </div>
  );
}
