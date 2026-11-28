"use client";
import { LoadingImage } from "@/components/loading-image";
import { useState } from "react";
import { safeDownloadUrl } from "../account/view-policy";
import { brandInitials, brandToneIndex } from "./reward-presentation";
import styles from "./vouchers-screen.module.css";

const DIMENSIONS = {
  sm: 44,
  md: 56,
  lg: 76,
} as const;

const SIZE_CLASSES = {
  sm: styles.artworkSm,
  md: styles.artworkMd,
  lg: styles.artworkLg,
} as const;

const TONE_CLASSES = [
  styles.artworkTone0,
  styles.artworkTone1,
  styles.artworkTone2,
  styles.artworkTone3,
] as const;

export function BrandArtwork({
  src,
  fallbackSrc,
  name,
  size = "md",
}: Readonly<{
  src?: string | null;
  fallbackSrc?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}>) {
  const [failedUrls, setFailedUrls] = useState<readonly string[]>([]);

  const candidates = [src, fallbackSrc].filter(
    (url, idx, list): url is string =>
      Boolean(url) &&
      list.indexOf(url) === idx &&
      safeDownloadUrl(url) &&
      !failedUrls.includes(url),
  );
  const activeUrl = candidates[0];
  const px = DIMENSIONS[size];
  const toneClass = TONE_CLASSES[brandToneIndex(name)];

  if (!activeUrl) {
    return (
      <span
        className={`${styles.artwork} ${SIZE_CLASSES[size]} ${styles.artworkFallback} ${toneClass}`}
        aria-hidden="true"
      >
        {brandInitials(name)}
      </span>
    );
  }

  return (
    <span className={`${styles.artwork} ${SIZE_CLASSES[size]}`}>
      <LoadingImage
        src={activeUrl}
        alt={`Logo ${name}`}
        width={px}
        height={px}
        unoptimized
        referrerPolicy="no-referrer"
        className={styles.artworkImage}
        onError={() => {
          setFailedUrls((prev) =>
            prev.includes(activeUrl) ? prev : [...prev, activeUrl],
          );
        }}
      />
    </span>
  );
}
