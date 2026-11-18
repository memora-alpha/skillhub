"use client";
import Image, { type ImageProps } from "next/image";
import { useCallback, useState, type ImgHTMLAttributes } from "react";
import styles from "./loading-image.module.css";

function useImageReady(
  source: ImageProps["src"] | ImgHTMLAttributes<HTMLImageElement>["src"],
) {
  const [loaded, setLoaded] = useState<{ source: typeof source } | null>(null);
  const ready = loaded !== null && loaded.source === source;
  const finish = useCallback(() => setLoaded({ source }), [source]);
  const ref = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete) finish();
    },
    [finish],
  );
  return { ready, finish, ref };
}

export function LoadingImage({
  className = "",
  alt,
  onLoad,
  onError,
  ...props
}: Readonly<ImageProps>) {
  const { ready, finish, ref } = useImageReady(props.src);
  const loadingClass = ready ? "" : " " + styles.loading;
  return (
    <Image
      {...props}
      alt={alt}
      ref={ref}
      className={className + loadingClass}
      aria-busy={!ready || undefined}
      onLoad={(event) => {
        finish();
        onLoad?.(event);
      }}
      onError={(event) => {
        finish();
        onError?.(event);
      }}
    />
  );
}

export function LoadingNativeImage({
  className = "",
  alt = "",
  onLoad,
  onError,
  ...props
}: Readonly<ImgHTMLAttributes<HTMLImageElement>>) {
  const { ready, finish, ref } = useImageReady(props.src);
  const loadingClass = ready ? "" : " " + styles.loading;
  return (
    // Evidence previews use the authenticated, expiring URL returned by the API.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={alt}
      ref={ref}
      className={className + loadingClass}
      aria-busy={!ready || undefined}
      onLoad={(event) => {
        finish();
        onLoad?.(event);
      }}
      onError={(event) => {
        finish();
        onError?.(event);
      }}
    />
  );
}
