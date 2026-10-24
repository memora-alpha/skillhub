import { useEffect, useRef, useState } from "react";
import { useController, useWatch, type UseFormReturn } from "react-hook-form";
import type { RequestDraft } from "../schemas/request-form";
import { MAX_REQUEST_TAGS, proposedTagsSchema } from "../schemas/request-tags";
import { useTagOptions } from "./use-request-options";
import type { TagOption } from "../types";
import {
  canChooseRequestTag,
  tagCatalogQuery,
  tagKey,
} from "../utils/request-tag-options";

export function useRequestTagPicker(
  form: UseFormReturn<RequestDraft>,
  disabled: boolean,
) {
  const [ids, proposals] = useWatch({
    control: form.control,
    name: ["tagIds", "proposedTags"],
  });
  const { field, fieldState } = useController({
    control: form.control,
    name: "tagSearch",
  });
  const [expanded, setExpanded] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string>();
  const labels = useRef(new Map<string, TagOption>());
  const lookup = tagCatalogQuery(field.value);
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(lookup), 300);
    return () => clearTimeout(timer);
  }, [lookup]);
  const query = useTagOptions(
    keyword || undefined,
    (!disabled && expanded) || ids.length > 0,
  );
  const matches = [
    ...new Map(
      query.data?.pages
        .flatMap((page) => page.items)
        .map((tag) => [tag.id, tag]),
    ).values(),
  ];
  matches.forEach((tag) => labels.current.set(tag.id, tag));
  const exact = [...labels.current.values()].find(
    (tag) => tagKey(tag.label) === tagKey(field.value),
  );
  const full = ids.length + proposals.length >= MAX_REQUEST_TAGS;
  const options =
    exact && !matches.some((tag) => tag.id === exact.id)
      ? [exact, ...matches]
      : matches;
  const canChoose = (tag: TagOption) =>
    !disabled && canChooseRequestTag(ids, proposals, tag);
  const change = (name: "tagIds" | "proposedTags", value: string[]) => {
    if (disabled) return;
    form.setValue(name, value, { shouldDirty: true, shouldValidate: true });
    setError(undefined);
  };
  function clearSearch() {
    if (disabled) return;
    form.setValue("tagSearch", "", { shouldDirty: true, shouldValidate: true });
    form.clearErrors("tagSearch");
    setError(undefined);
  }
  function search(value: string) {
    if (disabled) return;
    field.onChange(value);
    setExpanded(true);
    setError(undefined);
  }
  function choose(tag: TagOption) {
    if (!canChoose(tag)) return;
    const remaining = proposals.filter(
      (label) => tagKey(label) !== tagKey(tag.label),
    );
    change("proposedTags", remaining);
    change("tagIds", [...ids, tag.id]);
    clearSearch();
  }
  const settled =
    keyword === lookup && !query.isFetching && !query.isPending && !query.error;
  function add() {
    if (disabled || !field.value.trim() || !settled) return;
    if (exact) {
      if (ids.includes(exact.id)) clearSearch();
      else choose(exact);
      return;
    }
    if (full) return;
    const result = proposedTagsSchema.safeParse([...proposals, field.value]);
    if (!result.success) {
      setError(result.error.issues[0]?.message);
      return;
    }
    change("proposedTags", result.data);
    clearSearch();
  }
  return {
    ids,
    proposals,
    field,
    expanded,
    setExpanded,
    query,
    options,
    labels: labels.current,
    exact,
    full,
    settled,
    add,
    search,
    clearSearch,
    choose,
    canChoose,
    change,
    error: error ?? fieldState.error?.message,
  };
}
