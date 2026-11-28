"use client";
import { LoadingButton } from "@/components/loading-button";
import { LoadingImage as Image } from "@/components/loading-image";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { UploadControl } from "../components/upload-control";
import { Feedback, Status } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { safeDownloadUrl } from "./view-policy";
import type { Material, OwnedMaterial } from "./account-types";
import styles from "./my-materials.module.css";

export function MaterialCoverStatus({
  cover,
}: Readonly<{ cover?: OwnedMaterial["cover"] }>) {
  if (!cover?.attached) return null;
  const labels: Record<string, string> = {
    NONE: "Chưa có ảnh bìa",
    PENDING: "Đang chờ tạo ảnh xem trước",
    PROCESSING: "Đang xử lý ảnh bìa",
    READY: "Ảnh bìa đã sẵn sàng",
    FAILED: "Chưa tạo được ảnh xem trước",
    REJECTED: "Ảnh bìa không được chấp nhận",
  };
  const isProcessing = ["PENDING", "PROCESSING"].includes(
    cover.processingStatus,
  );
  const hasIssue =
    !!cover.failureCode ||
    ["FAILED", "REJECTED"].includes(cover.processingStatus);
  return (
    <details className={styles.coverDetails} open={hasIssue || undefined}>
      <summary className={styles.coverSummary}>
        <span className={styles.coverSummaryLeft}>
          <ProductIcon name={hasIssue ? "alert" : "eye"} size={15} />
          {isProcessing ? (
            <LoadingSkeleton
              variant="inline"
              label={labels[cover.processingStatus]}
            />
          ) : (
            <span>
              {labels[cover.processingStatus] ??
                "Chưa có kết quả kiểm tra ảnh bìa"}
            </span>
          )}
        </span>
        <span className={styles.coverChevron} aria-hidden="true">
          <ProductIcon name="chevron" size={14} />
        </span>
      </summary>
      <div className={styles.coverBody}>
        <div className={styles.coverPreviewFrame}>
          <MaterialThumbnail thumbnail={cover.preview} />
        </div>
        <p className={styles.coverMetaLine}>
          <strong>
            {cover.file?.originalFilename ?? "Ảnh bìa đã đính kèm"}
          </strong>
          {cover.file && (
            <>
              <span>· Trạng thái tệp:</span>
              <Status
                value={cover.file.state}
                label={cover.file.state === "READY" ? "Sẵn sàng" : undefined}
              />
            </>
          )}
        </p>
        {cover.failureCode && (
          <p className="learner-error">
            Ảnh bìa chưa xử lý thành công. Hãy cập nhật trạng thái; nếu vẫn lỗi,
            liên hệ hỗ trợ. Chỉ thay ảnh khi tài liệu còn cho phép chỉnh sửa.
          </p>
        )}
      </div>
    </details>
  );
}

export function MaterialThumbnail({
  thumbnail,
  large = false,
}: Readonly<{ thumbnail?: Material["thumbnail"]; large?: boolean }>) {
  const [failed, setFailed] = useState<string>();
  let url: string | undefined;
  if (thumbnail?.kind === "GENERATED")
    url = large ? thumbnail.largeUrl : thumbnail.smallUrl;
  return url && url !== failed && safeDownloadUrl(url) ? (
    <Image
      src={url}
      alt="Ảnh bìa tài liệu"
      width={large ? 960 : 480}
      height={large ? 540 : 270}
      unoptimized
      style={{
        width: "100%",
        height: "100%",
        maxHeight: large ? 360 : 220,
        objectFit: "cover",
        borderRadius: "inherit",
      }}
      onError={() => setFailed(url)}
    />
  ) : (
    <ProductIcon name="file" size={large ? 64 : 45} />
  );
}
export function useMaterialCover() {
  const [coverFileId, setCoverFileId] = useState<string | null>();
  const [uploading, setUploading] = useState(false);
  const status = useUserResource<{ state: string; moderationStatus?: string }>(
    coverFileId ? `me/materials/files/${coverFileId}` : null,
    {
      refetchInterval: (file) =>
        file &&
        ([
          "READY",
          "REJECTED",
          "SCAN_FAILED",
          "UPLOAD_FAILED",
          "CLEANUP_PENDING",
          "DELETED",
        ].includes(file.state) ||
          ["REVIEW_REQUIRED", "FAILED"].includes(file.moderationStatus ?? ""))
          ? false
          : 3000,
    },
  );
  return {
    coverFileId,
    setCoverFileId,
    uploading,
    setUploading,
    status,
    blocked: uploading || (!!coverFileId && status.data?.state !== "READY"),
  };
}
export function MaterialCoverControl({
  cover,
  disabled,
  existing,
}: Readonly<{
  cover: ReturnType<typeof useMaterialCover>;
  disabled: boolean;
  existing?: boolean;
}>) {
  return (
    <section className="learner-stack" aria-label="Ảnh bìa tài liệu">
      <UploadControl
        label="Ảnh bìa (không bắt buộc)"
        endpoint="me/materials/cover-files"
        accept="image/jpeg,image/png,image/webp"
        maxBytes={10000000}
        disabled={disabled}
        onBusyChange={cover.setUploading}
        onUploaded={cover.setCoverFileId}
      />
      {cover.coverFileId && (
        <>
          <Feedback
            variant="inline"
            loading={cover.status.initialLoading}
            error={cover.status.error}
            reload={cover.status.reload}
            refreshing={
              !!(cover.status.loading && !cover.status.initialLoading)
            }
          />
          <p>
            Ảnh bìa đã chọn ·{" "}
            <Status
              value={
                cover.status.data?.moderationStatus === "REVIEW_REQUIRED"
                  ? "REVIEW_REQUIRED"
                  : (cover.status.data?.state ?? "PENDING")
              }
              label={
                cover.status.data?.moderationStatus === "REVIEW_REQUIRED"
                  ? "Cần kiểm duyệt thêm, hãy chọn ảnh bìa khác hoặc dùng ảnh mặc định"
                  : cover.status.data?.state === "READY"
                    ? "Sẵn sàng"
                    : undefined
              }
            />
          </p>
        </>
      )}
      {(cover.coverFileId || (existing && cover.coverFileId !== null)) && (
        <LoadingButton
          type="button"
          className="btn"
          disabled={disabled || cover.uploading}
          onClick={() => cover.setCoverFileId(null)}
          loading={!!cover.uploading}
        >
          Dùng ảnh bìa mặc định
        </LoadingButton>
      )}
      {cover.coverFileId === null && (
        <small className="muted">Sẽ dùng hình minh họa mặc định.</small>
      )}
    </section>
  );
}
