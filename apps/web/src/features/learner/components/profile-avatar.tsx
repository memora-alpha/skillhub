"use client";

import Image from "next/image";
import { useState } from "react";

function avatarSource(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    return url.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function ProfileAvatar({
  fullName,
  avatarUrl,
  className,
}: Readonly<{
  fullName: string;
  avatarUrl: string | null;
  className?: string;
}>) {
  const [failedSource, setFailedSource] = useState<string>();
  const source = avatarSource(avatarUrl);
  return (
    <span className={className} aria-hidden="true">
      {source && source !== failedSource ? (
        <Image
          src={source}
          alt=""
          width={80}
          height={80}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailedSource(source)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        (Array.from(fullName.trim())[0]?.toLocaleUpperCase("vi") ?? "S")
      )}
    </span>
  );
}
