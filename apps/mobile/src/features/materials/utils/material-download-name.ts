export function materialDownloadName(value: string) {
  return (
    [...value]
      .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
      .join("")
      .replace(/[\\/:*?"<>|]/g, "_")
      .slice(-160)
      .trim() || "tai-lieu"
  );
}
