import { MAX_REQUEST_TAGS, normalizeTagLabel } from "../schemas/request-tags";
import type { TagOption } from "../types";

export const tagKey = (label: string) => normalizeTagLabel(label).toLowerCase();

export function tagCatalogQuery(label: string) {
  let query = "";
  for (const character of normalizeTagLabel(label)) {
    if (query.length + character.length > 120) break;
    query += character;
  }
  return query;
}

export function canChooseRequestTag(
  ids: readonly string[],
  proposals: readonly string[],
  tag: TagOption,
) {
  if (ids.includes(tag.id)) return false;
  const remaining = proposals.filter(
    (label) => tagKey(label) !== tagKey(tag.label),
  );
  return ids.length + remaining.length + 1 <= MAX_REQUEST_TAGS;
}
