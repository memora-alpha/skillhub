import type { Proposal } from "../api/proposals-api";

function normalize(value: string) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .replaceAll(/đ/g, "d")
    .trim();
}

export function searchProposals(items: Proposal[], keyword: string) {
  const search = normalize(keyword);
  return search
    ? items.filter((item) => normalize(item.message).includes(search))
    : items;
}
