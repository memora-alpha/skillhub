"use client";
import { useState } from "react";
import { SearchInput } from "@/components/search-input";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import type { Skill } from "../types";
import { Feedback, More } from "./common";
import { LoadingSkeleton } from "@/components/loading-skeleton";
export function SkillPicker({
  value,
  onChange,
  disabled = false,
}: Readonly<{
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}>) {
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState("");
  const normalized = search.trim().normalize("NFC");
  const searchError =
    normalized && Array.from(normalized).length < 2
      ? "Nhập ít nhất 2 ký tự để tìm kỹ năng, hoặc để trống để xem tất cả."
      : undefined;
  const [categoryId, setCategoryId] = useState("");
  const query = useUserList<Skill>(
    "skills?limit=20" +
      (term ? "&q=" + encodeURIComponent(term) : "") +
      (categoryId ? "&categoryId=" + encodeURIComponent(categoryId) : ""),
  );
  const selected = useUserResource<Skill>(value ? "skills/" + value : null);
  return (
    <fieldset className="learner-picker" disabled={disabled}>
      <legend>Kỹ năng muốn học / chia sẻ</legend>
      <p>
        {value ? (
          <>
            Đã chọn:{" "}
            {selected.data?.name ??
              query.items.find((item) => item.id === value)?.name ??
              (selected.error ? (
                "Không tải được tên kỹ năng"
              ) : (
                <LoadingSkeleton
                  variant="inline"
                  label="Đang tải tên kỹ năng"
                />
              ))}
          </>
        ) : (
          "Chọn một kỹ năng trong danh mục."
        )}
      </p>
      <div className="learner-search">
        <SearchInput
          aria-label="Tìm kỹ năng"
          value={search}
          maxLength={100}
          onChange={setSearch}
          onSearch={setTerm}
          minimumLength={2}
        />
      </div>
      <details>
        <summary>Lọc theo danh mục</summary>
        <label>
          Mã danh mục
          <input
            placeholder="UUID danh mục"
            onBlur={(event) => {
              if (event.currentTarget.validity.valid)
                setCategoryId(event.currentTarget.value.trim());
            }}
            pattern="[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"
          />
        </label>
      </details>
      <Feedback error={searchError} />
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      <div className="learner-choice-list">
        {query.items.map((skill) => (
          <button
            type="button"
            className={
              "learner-choice " + (value === skill.id ? "selected" : "")
            }
            key={skill.id}
            onClick={() => onChange(skill.id)}
            aria-pressed={value === skill.id}
          >
            {skill.name}
          </button>
        ))}
      </div>
      <More
        cursor={query.cursor}
        loading={query.loading}
        onMore={() => {
          void query.more();
        }}
      />
    </fieldset>
  );
}
