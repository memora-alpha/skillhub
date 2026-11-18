export function materialDownloadName(value: string) {
  return (
    [...value]
      .filter((char) => {
        const code = char.codePointAt(0) ?? 0;
        return code >= 32 && code !== 127;
      })
      .join("")
      .replace(/[\\/:*?"<>|]/g, "_")
      .slice(-160)
      .trim() || "tai-lieu"
  );
}
