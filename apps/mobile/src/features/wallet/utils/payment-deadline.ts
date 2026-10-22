// Presentation only: the device clock never expires/cancels or renews a Payment.
export function paymentDeadline(expiresAt: string | null, now: number) {
  const deadline = expiresAt === null ? Number.NaN : Date.parse(expiresAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(now))
    return { kind: "unavailable" as const, label: "Đang cập nhật" };
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  if (!remaining)
    return { kind: "awaiting-server" as const, label: "Chờ xác nhận" };
  const minutes = Math.floor(remaining / 60),
    seconds = remaining % 60;
  return {
    kind: "countdown" as const,
    label: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}
