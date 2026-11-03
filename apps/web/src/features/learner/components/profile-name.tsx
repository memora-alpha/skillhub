"use client";
import { useUserResource } from "../hooks/use-user-resource";
export function ProfileName({ id }: Readonly<{ id: string }>) {
  const profile = useUserResource<{ fullName: string }>("profiles/" + id);
  return (
    <span>
      {profile.data?.fullName ?? (profile.error ? "Đối tác" : "Đang tải tên…")}
    </span>
  );
}
