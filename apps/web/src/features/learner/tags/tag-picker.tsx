"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUserList } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { findInPages } from "../api/find-page";
import { Feedback, More } from "../components/common";
import { normalizeTag, validateTagSelection, type Tag } from "./tag-policy";

export function TagPicker({
  ids,
  proposed,
  onChange,
  disabled,
}: Readonly<{
  ids: string[];
  proposed: string[];
  onChange: (ids: string[], proposed: string[]) => void;
  disabled: boolean;
}>) {
  const { request } = useUserSession();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<Tag[]>([]);
  const query = useUserList<Tag>(
    "tags?limit=20" + (term ? "&q=" + encodeURIComponent(term) : ""),
  );
  // Resolve existing selections without silently deleting tags absent from a search page.
  const selectionKey = ids.join(",");
  useEffect(() => {
    let active = true;
    const wanted = selectionKey ? selectionKey.split(",") : [];
    const found = new Map<string, Tag>();
    const work = wanted.length
      ? findInPages<Tag>(request, "tags?limit=100", (tag) => {
          if (wanted.includes(tag.id)) found.set(tag.id, tag);
          return found.size === wanted.length;
        })
      : Promise.resolve(undefined);
    void work
      .then(() => {
        if (active) setSelected([...found.values()]);
      })
      .catch(() => {
        /* Keep IDs; the server validates availability on save. */
      });
    return () => {
      active = false;
    };
  }, [selectionKey, request]);
  function change(nextIds: string[], nextProposed: string[]) {
    try {
      validateTagSelection(nextIds, nextProposed, [
        ...query.items,
        ...selected,
      ]);
      onChange(nextIds, nextProposed);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tag chưa hợp lệ.");
    }
  }
  return (
    <fieldset className="learner-picker" disabled={disabled}>
      <legend>Tag của bài đăng</legend>
      <p>
        Tag có sẵn dùng ngay. Tag mới đề xuất sẽ chờ duyệt cùng bài, chưa được
        thêm vào danh mục chung.
      </p>
      <div className="learner-search">
        <input
          aria-label="Tìm tag có sẵn"
          value={search}
          maxLength={120}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          onClick={() => setTerm(search.trim())}
        >
          Tìm tag
        </button>
      </div>
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-choice-list">
        {query.items.map((tag) => (
          <button
            type="button"
            className={
              "learner-choice " + (ids.includes(tag.id) ? "selected" : "")
            }
            aria-pressed={ids.includes(tag.id)}
            key={tag.id}
            onClick={() =>
              change(
                ids.includes(tag.id)
                  ? ids.filter((id) => id !== tag.id)
                  : [...ids, tag.id],
                proposed,
              )
            }
          >
            {tag.label}
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
      {!!ids.length && (
        <div>
          <p>Tag đã chọn:</p>
          {ids.map((id) => (
            <button
              type="button"
              className="btn"
              key={id}
              onClick={() =>
                change(
                  ids.filter((item) => item !== id),
                  proposed,
                )
              }
            >
              Bỏ{" "}
              {selected.find((tag) => tag.id === id)?.label ??
                query.items.find((tag) => tag.id === id)?.label ??
                "tag đã chọn (cần kiểm tra còn hiệu lực)"}
            </button>
          ))}
        </div>
      )}
      <label>
        <span>Đề xuất tag mới cho bài này</span>
        <input
          value={label}
          maxLength={80}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <button
        className="btn"
        type="button"
        onClick={() => {
          try {
            const value = normalizeTag(label);
            const existing = query.items.find(
              (tag) =>
                normalizeTag(tag.label).toLowerCase() === value.toLowerCase(),
            );
            change(
              existing ? [...new Set([...ids, existing.id])] : ids,
              existing ? proposed : [...proposed, value],
            );
            setLabel("");
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Tên tag chưa hợp lệ.",
            );
          }
        }}
      >
        Thêm tag đề xuất
      </button>
      {proposed.map((value, index) => (
        <p key={value}>
          {value} · Chờ duyệt{" "}
          <button
            type="button"
            className="learner-text-button"
            onClick={() =>
              change(
                ids,
                proposed.filter((_, i) => i !== index),
              )
            }
          >
            Bỏ đề xuất {value}
          </button>
        </p>
      ))}
      <Feedback error={error} />
      <Link className="learner-card-link" href="/learn/tag-requests">
        Đề xuất tag độc lập & theo dõi yêu cầu của tôi →
      </Link>
    </fieldset>
  );
}
