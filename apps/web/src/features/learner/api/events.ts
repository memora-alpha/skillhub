export function eventAffectsResource(path: unknown, event: string) {
  if (typeof path !== "string") return false;
  if (event === "resync-required") return true;
  if (event === "wallet.updated") return path.startsWith("me/wallet");
  if (event.startsWith("chat.")) return path.startsWith("conversations");
  if (event.startsWith("proposal."))
    return ["proposals", "conversations", "learning-requests"].some((prefix) =>
      path.startsWith(prefix),
    );
  if (event.startsWith("notification."))
    return ["sessions", "learning-paths", "me/wallet"].some((prefix) =>
      path.startsWith(prefix),
    );
  return false;
}
