"use client";
import { useState } from "react";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import type { Skill } from "../types";
import { Feedback, More } from "./common";
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
  const query = useUserList<Skill>(
    "skills?limit=20&q=" + encodeURIComponent(term),
  );
  const selected = useUserResource<Skill>(value ? "skills/" + value : null);
  return (
    <fieldset className="learner-picker" disabled={disabled}>
      <legend>Kỹ năng muốn học / chia sẻ</legend>
      <p>
        {value
          ? "Đã chọn: " +
            (selected.data?.name ??
              query.items.find((item) => item.id === value)?.name ??
              "Đang tải…")
          : "Chọn một kỹ năng trong danh mục."}
      </p>
      <div className="learner-search">
        <input
          aria-label="Tìm kỹ năng"
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn"
          type="button"
          onClick={() => setTerm(search.trim())}
        >
          Tìm
        </button>
      </div>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
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
