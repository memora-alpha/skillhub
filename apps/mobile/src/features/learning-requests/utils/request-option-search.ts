function searchable(value: string) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .trim();
}
export function matchingRequestOptions<T extends { label: string }>(
  options: T[],
  keyword: string,
) {
  const words = searchable(keyword).split(/\s+/).filter(Boolean);
  return options.filter((option) =>
    words.every((word) => searchable(option.label).includes(word)),
  );
}
