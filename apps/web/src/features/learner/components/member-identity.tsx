"use client";
import type { ReactNode } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { ProfileAvatar } from "./profile-avatar";
import styles from "./member-identity.module.css";

export function MemberIdentity({
  id,
  description,
  small = false,
}: Readonly<{
  id: string;
  description?: ReactNode;
  small?: boolean;
}>) {
  const profile = useUserResource<{
    fullName: string;
    avatarUrl: string | null;
  }>("profiles/" + id);
  const name = profile.data?.fullName ?? "Thành viên SkillHub";
  return (
    <span className={styles.identity + (small ? " " + styles.small : "")}>
      <ProfileAvatar
        fullName={name}
        avatarUrl={profile.data?.avatarUrl ?? null}
        className={styles.avatar}
      />
      <span className={styles.text}>
        <strong>{name}</strong>
        {description && <small>{description}</small>}
      </span>
    </span>
  );
}
