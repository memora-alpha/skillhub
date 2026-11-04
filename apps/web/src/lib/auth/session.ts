import type { NextResponse } from "next/server";

export const sessionCookies = {
  access: "skillhub_access",
  refresh: "skillhub_refresh",
  options: {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api",
  },
};

export function clearSessionCookies(response: NextResponse) {
  for (const name of [sessionCookies.access, sessionCookies.refresh])
    response.cookies.set(name, "", { ...sessionCookies.options, maxAge: 0 });
  return response;
}

export function sessionDestination(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const actor = value as Record<string, unknown>;
  if (
    typeof actor.userId !== "string" ||
    !actor.userId ||
    actor.accountStatus !== "ACTIVE" ||
    actor.emailVerified !== true ||
    !Array.isArray(actor.roles) ||
    !actor.roles.every((role) => typeof role === "string")
  )
    return null;
  if (actor.roles.includes("ADMIN"))
    return { role: "ADMIN", destination: "/admin" } as const;
  if (actor.roles.includes("STAFF"))
    return { role: "STAFF", destination: "/staff" } as const;
  if (actor.roles.includes("USER"))
    return { role: "USER", destination: "/learn" } as const;
  return null;
}

export type SessionDestination = NonNullable<
  ReturnType<typeof sessionDestination>
>;
