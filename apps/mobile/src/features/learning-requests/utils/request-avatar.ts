// S3 presigned avatar URLs carry their server signing time and lifetime.
export function requestAvatarExpired(
  value: string | null | undefined,
  now = Date.now(),
) {
  if (!value) return false;
  try {
    const query = new URL(value).searchParams;
    const date = query.get("X-Amz-Date") ?? "";
    const lifetime = query.get("X-Amz-Expires") ?? "";
    if (!/^\d{8}T\d{6}Z$/.test(date) || !/^\d+$/.test(lifetime)) return false;
    const signedAt = Date.parse(
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`,
    );
    const seconds = Number(lifetime);
    return (
      Number.isFinite(signedAt) &&
      Number.isSafeInteger(seconds) &&
      signedAt + seconds * 1000 <= now
    );
  } catch {
    return false;
  }
}
