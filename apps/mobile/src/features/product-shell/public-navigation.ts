import type { Href } from "expo-router";
import { uuid } from "@/lib/http/contracts";

export function guestDestination(
  kind: "explore" | "profile" | "request",
  value?: string | string[],
): Href {
  if (kind === "explore") {
    const query =
      typeof value === "string" ? value.normalize("NFKC").trim() : "";
    return { pathname: "/discover", params: { tab: "requests", query } };
  }
  const parsed = uuid.safeParse(value);
  if (!parsed.success) return kind === "profile" ? "/search" : "/discover";
  return kind === "profile"
    ? { pathname: "/profiles/[userId]", params: { userId: parsed.data } }
    : { pathname: "/requests/[id]", params: { id: parsed.data } };
}
