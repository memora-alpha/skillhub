"use client";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { Feedback } from "../components/common";
import { safeDownloadUrl } from "./view-policy";

/** Purchased access can survive archive/deletion of the public listing. */
export function MaterialOrderDownload({
  materialId,
  onAccessed,
  disabled,
  onConfirmingChange,
}: Readonly<{
  materialId: string;
  onAccessed: () => void;
  disabled: boolean;
  onConfirmingChange: (value: boolean) => void;
}>) {
  const { request } = useUserSession();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function download() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    try {
      const result = await request<{ url: string; expiresAt: string }>(
        `materials/${materialId}/download`,
      );
      if (!active.current) return;
      if (
        !safeDownloadUrl(result.data.url) ||
        !Number.isFinite(Date.parse(result.data.expiresAt)) ||
        Date.parse(result.data.expiresAt) <= Date.now()
      )
        throw new Error("Liên kết tải chưa sẵn sàng. Hãy thử lại.");
      setConfirming(false);
      onConfirmingChange(false);
      window.location.assign(result.data.url);
    } catch (cause) {
      if (active.current)
        setError(
          cause instanceof Error ? cause.message : "Chưa tải được tài liệu.",
        );
    } finally {
      lock.current = false;
      if (active.current) {
        setPending(false);
        onAccessed();
      }
    }
  }
  return (
    <div>
      <LoadingButton
        type="button"
        className="btn"
        disabled={disabled || pending || confirming}
        onClick={() => {
          setConfirming(true);
          onConfirmingChange(true);
        }}
        loading={!!pending}
      >
        Tải tài liệu đã mua
      </LoadingButton>
      {confirming && (
        <section
          className="learner-notice"
          aria-label="Xác nhận tải tài liệu đã mua"
        >
          <strong>Bắt đầu sử dụng tài liệu?</strong>
          <p>
            Khi cấp liên kết tải, đơn mua sẽ không còn đủ điều kiện hoàn tự
            động, kể cả khi việc tải bị gián đoạn.
          </p>
          <div className="learner-actions">
            <LoadingButton
              type="button"
              className="btn btn-primary"
              disabled={disabled || pending}
              onClick={() => void download()}
              loading={!!pending}
            >
              {pending ? "Đang chuẩn bị tải…" : "Xác nhận và tải"}
            </LoadingButton>
            <LoadingButton
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                onConfirmingChange(false);
              }}
              loading={!!pending}
            >
              Để sau
            </LoadingButton>
          </div>
        </section>
      )}
      <Feedback error={error} />
    </div>
  );
}
