"use client";
import { LoadingButton } from "@/components/loading-button";
import Link from "next/link";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useUserSession } from "../auth/session";
import { useUserSnapshot } from "../hooks/use-user-snapshot";
import { useUserCommand } from "../hooks/use-user-command";
import { UserApiError } from "../api/client";
import { pageUrl } from "../api/page-url";
import {
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  formatTime,
} from "../components/common";
import type { Material } from "./account-types";
import { MaterialThumbnail } from "./material-cover";
import { MaterialsSubnav } from "./materials-subnav";
import { useListPages } from "@/components/pagination/use-list-pages";
import { ListPagination } from "@/components/pagination/list-pagination";

type Favorite = { id: string; savedAt: string; material: Material };
type LibraryEntry = {
  id?: string;
  savedAt?: string;
  firstAccessedAt?: string;
  lastAccessedAt?: string;
  material: Material;
};
const favoritePath = "me/material-favorites?limit=100";

export function MaterialFavorite({
  materialId,
}: Readonly<{ materialId: string }>) {
  const favorites = useUserSnapshot<Favorite>(favoritePath, {
    scope: materialId,
    stopAt: (item) => item.material.id === materialId,
  });
  const saved = favorites.items.some((item) => item.material.id === materialId);
  return (
    <div>
      <FavoriteButton
        materialId={materialId}
        saved={saved}
        disabled={!favorites.complete || !!favorites.error}
      />
      <Feedback
        error={favorites.error}
        reload={() => {
          void favorites.reload();
        }}
      />
    </div>
  );
}
function FavoriteButton({
  materialId,
  saved,
  disabled = false,
}: Readonly<{ materialId: string; saved: boolean; disabled?: boolean }>) {
  const { actor, request } = useUserSession();
  const cache = useQueryClient();
  const command = useUserCommand(true);
  function saveLabel() {
    if (command.pending) {
      return "Đang lưu…" as const;
    }
    if (saved) {
      return "Bỏ lưu tài liệu" as const;
    }
    return "Lưu tài liệu" as const;
  }
  return (
    <div>
      <LoadingButton
        type="button"
        className="btn"
        aria-pressed={saved}
        disabled={
          disabled ||
          command.pending ||
          (command.uncertain && !command.canRetry)
        }
        onClick={async () => {
          const result = await command.run(
            `favorite:${materialId}:${saved}`,
            () =>
              request(`materials/${materialId}/favorite`, {
                method: saved ? "DELETE" : "POST",
              }),
          );
          if (result)
            await cache.invalidateQueries({
              predicate: (query) =>
                query.queryKey[0] === "learner" &&
                query.queryKey[1] === actor.userId &&
                typeof query.queryKey[2] === "string" &&
                query.queryKey[2].startsWith("me/material-favorites"),
            });
        }}
        loading={!!command.pending}
      >
        {saveLabel()}
      </LoadingButton>
      <CommandFeedback command={command} />
    </div>
  );
}

export function MaterialLibrary() {
  const { actor } = useUserSession();
  const [tab, setTab] = useState("saved");
  return (
    <>
      <MaterialsSubnav current="/learn/materials/library" />
      <PageHeading
        eyebrow="Kho tài liệu số"
        title="Thư viện của tôi"
        description="Tìm lại tài liệu đã lưu và tài liệu miễn phí bạn đã tải."
      />
      <fieldset className="learner-tabs" aria-label="Loại thư viện">
        <button
          type="button"
          aria-pressed={tab === "saved"}
          onClick={() => setTab("saved")}
        >
          Đã lưu
        </button>
        <button
          type="button"
          aria-pressed={tab === "free"}
          onClick={() => setTab("free")}
        >
          Miễn phí đã tải
        </button>
      </fieldset>
      <LibraryList key={`${actor.userId}:${tab}`} free={tab === "free"} />
    </>
  );
}
function LibraryList({ free }: Readonly<{ free: boolean }>) {
  const { actor, request } = useUserSession();
  const path = free
    ? "me/material-library/free?limit=20"
    : "me/material-favorites?limit=20";
  const query = useInfiniteQuery({
    queryKey: ["learner", actor.userId, path],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const result = await request<LibraryEntry[]>(pageUrl(path, pageParam), {
        signal,
      });
      const pagination = result.meta?.pagination;
      if (
        !Array.isArray(result.data) ||
        result.data.some((entry) => !entry.material?.id) ||
        typeof pagination?.hasMore !== "boolean" ||
        pagination.hasMore !== !!pagination.nextCursor ||
        (pageParam && pagination.nextCursor === pageParam)
      )
        throw new UserApiError(502, "API_RESPONSE_INVALID");
      return result;
    },
    getNextPageParam: (page, _pages, _last, params) => {
      const next = page.meta?.pagination?.nextCursor;
      return next && !params.includes(next) ? next : undefined;
    },
  });
  const rows = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.data)
        .map((row) => [row.material.id, row]) ?? [],
    ).values(),
  ];
  const denied =
    query.error instanceof UserApiError &&
    [401, 403, 404].includes(query.error.status);
  const pagination = useListPages({
    scope: `${actor.userId}:${path}`,
    chunks: denied ? [] : (query.data?.pages.map((page) => page.data) ?? []),
    loading: query.isFetching,
    hasMore: !!query.hasNextPage && !denied,
    error: query.error?.message,
    more: () => query.fetchNextPage({ cancelRefetch: false }),
    reload: () => query.refetch(),
  });
  return (
    <>
      <Feedback
        loading={query.isPending}
        error={query.error?.message}
        reload={() => {
          void pagination.reload();
        }}
        refreshing={!!(query.isFetching && !query.isPending)}
      />
      {!denied && (
        <div className="learner-stack">
          {pagination.items.map((row) => (
            <Panel key={row.material.id}>
              <div style={{ width: "min(100%, 240px)", aspectRatio: "16 / 9" }}>
                <MaterialThumbnail thumbnail={row.material.thumbnail} />
              </div>
              <h2>{row.material.title}</h2>
              <p className="learner-prose">{row.material.description}</p>
              <p>
                {free ? "Tải gần nhất: " : "Đã lưu: "}
                {formatTime(row.lastAccessedAt ?? row.savedAt ?? "")}
              </p>
              <div className="learner-actions">
                <Link
                  className="btn btn-primary"
                  href={`/learn/materials/${row.material.id}`}
                >
                  Xem tài liệu
                </Link>
                {!free && <FavoriteButton materialId={row.material.id} saved />}
              </div>
            </Panel>
          ))}
        </div>
      )}
      {query.isSuccess && !rows.length && (
        <Empty>
          {free
            ? "Bạn chưa tải tài liệu miễn phí nào."
            : "Bạn chưa lưu tài liệu nào. Mở một tài liệu và chọn Lưu tài liệu để tìm lại sau."}
        </Empty>
      )}
      <ListPagination query={pagination} />
    </>
  );
}
