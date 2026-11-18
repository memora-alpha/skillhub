"use client";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useUserResource } from "../hooks/use-user-resource";
export function ProfileName({ id }: Readonly<{ id: string }>) {
  const profile = useUserResource<{ fullName: string }>("profiles/" + id);
  return (
    <span>
      {profile.data?.fullName ??
        (profile.error ? (
          "Đối tác"
        ) : (
          <LoadingSkeleton variant="inline" label="Đang tải tên" />
        ))}
    </span>
  );
}
