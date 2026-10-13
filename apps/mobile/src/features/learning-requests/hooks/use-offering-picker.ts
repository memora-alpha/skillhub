import { useEffect, useState } from "react";
import { uiLabel } from "@/constants/ui-copy";
import { useOfferingOptions } from "./use-request-options";
import { matchingRequestOptions } from "../utils/request-option-search";
import type { OwnerRequest } from "../types";
export function useOfferingPicker(
  selected: string[],
  disabled: boolean,
  initial?: OwnerRequest,
) {
  const query = useOfferingOptions();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  // The own-skills endpoint has no search query. Search loads subsequent pages
  // sequentially so a match beyond page one can still be found.
  useEffect(() => {
    if (
      expanded &&
      search.trim() &&
      !disabled &&
      query.hasNextPage &&
      !query.isFetching &&
      !query.error
    )
      void query.fetchNextPage({ cancelRefetch: false });
  }, [
    expanded,
    search,
    disabled,
    query.hasNextPage,
    query.isFetching,
    query.error,
    query.fetchNextPage,
  ]);
  const offeringLabel = (item: {
    skill: { name: string };
    level: string;
    verificationStatus: string;
  }) =>
    `${item.skill.name} · ${uiLabel(item.level)}${item.verificationStatus === "VERIFIED" ? " · Đã xác minh" : ""}`;
  const all = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((item) => [item.id, item]),
    ).values(),
  ];
  const options = all
    .filter(
      (item) =>
        item.isVisible && !item.archivedAt && item.skill.status === "ACTIVE",
    )
    .map((item) => ({
      id: item.id,
      label: offeringLabel(item),
    }));

  const matches = matchingRequestOptions(options, search).filter(
    (item) => !selected.includes(item.id),
  );
  const selectionLabels = [
    ...(initial?.offeredSharingSkills ?? []).map((item) => ({
      id: item.id,
      label: offeringLabel(item),
    })),
    ...all.map((item) => ({ id: item.id, label: offeringLabel(item) })),
  ];
  return {
    query,
    expanded,
    setExpanded,
    search,
    setSearch,
    visibleCount,
    setVisibleCount,
    options,
    matches,
    selectionLabels,
  };
}
