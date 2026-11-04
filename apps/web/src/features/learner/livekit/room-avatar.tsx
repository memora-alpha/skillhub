"use client";
import Image from "next/image";
import { useState } from "react";
import { roomInitials, safeRoomAvatar } from "./room-profiles";

export function RoomAvatar({
  name,
  avatarUrl,
  className,
}: Readonly<{ name: string; avatarUrl?: string | null; className?: string }>) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const url = safeRoomAvatar(avatarUrl);
  return (
    <span className={className} aria-hidden="true">
      {url && url !== failedUrl ? (
        <Image
          src={url}
          alt=""
          fill
          sizes="68px"
          unoptimized
          referrerPolicy="no-referrer"
          style={{ objectFit: "cover" }}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        roomInitials(name)
      )}
    </span>
  );
}
