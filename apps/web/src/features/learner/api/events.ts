export function eventAffectsResource(path: unknown, event: string) {
  if (typeof path !== "string") return false;
  if (event === "resync-required") return true;
  if (event === "wallet.updated")
    return ["me/wallet", "learning-paths", "me/achievements"].some((prefix) =>
      path.startsWith(prefix),
    );
  if (event === "payment.updated")
    return path.startsWith("payments") || path.startsWith("me/wallet");
  if (event.startsWith("chat.")) return path.startsWith("conversations");
  if (event.startsWith("session."))
    return ["sessions", "learning-paths", "me/achievements", "me/wallet"].some(
      (prefix) => path.startsWith(prefix),
    );
  if (event.startsWith("proposal."))
    return ["proposals", "conversations", "learning-requests"].some((prefix) =>
      path.startsWith(prefix),
    );
  if (event.startsWith("notification."))
    return [
      "notifications",
      "sessions",
      "learning-paths",
      "me/wallet",
      "reports/mine",
      "me/achievements",
    ].some((prefix) => path.startsWith(prefix));
  return false;
}
