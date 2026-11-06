"use client";
import { useEffect, useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { findInPages } from "../api/find-page";
import { Feedback } from "../components/common";
import type { Skill } from "../types";
import type { Tag } from "../tags/tag-policy";
import styles from "./posts.module.css";
export function PostSkillName({ id }: Readonly<{ id: string }>) {
  const skill = useUserResource<Skill>(id ? "skills/" + id : null);
  return (
    <>
      {skill.data?.name ??
        (skill.error ? "Kỹ năng không còn khả dụng" : "Đang tải tên kỹ năng…")}
    </>
  );
}
export function PostSelectedTags({ ids }: Readonly<{ ids: string[] }>) {
  const { request } = useUserSession();
  const selection = ids.join(",");
  const [result, setResult] = useState<{
    key: string;
    tags: Tag[];
    error?: string;
  }>({ key: "", tags: [] });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const wanted = selection.split(",").filter(Boolean),
      found = new Map<string, Tag>();
    const work = wanted.length
      ? findInPages<Tag>(request, "tags?limit=100", (tag) => {
          if (wanted.includes(tag.id)) found.set(tag.id, tag);
          return found.size === wanted.length;
        })
      : Promise.resolve(undefined);
    void work
      .then(() => {
        if (active) setResult({ key: selection, tags: [...found.values()] });
      })
      .catch(() => {
        if (active)
          setResult({
            key: selection,
            tags: [],
            error: "Chưa tải được tên tag đã chọn.",
          });
      });
    return () => {
      active = false;
    };
  }, [request, selection, attempt]);
  const tags = result.key === selection ? result.tags : [];
  return (
    <>
      <div className={styles.tags} aria-label="Chủ đề">
        {ids.map((id) => (
          <span key={id} className={styles.tag}>
            {tags.find((tag) => tag.id === id)?.label ??
              (result.key === selection && !result.error
                ? "Tag không còn hoạt động"
                : "Đang tải…")}
          </span>
        ))}
      </div>
      <Feedback
        error={result.error}
        reload={() => setAttempt((value) => value + 1)}
      />
    </>
  );
}
