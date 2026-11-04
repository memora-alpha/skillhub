export function pageUrl(path: string, cursor: string | undefined) {
  if (!cursor) return path;
  const separator = path.includes("?") ? "&" : "?";
  return path + separator + new URLSearchParams({ cursor });
}
