"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSnapshot } from "../hooks/use-user-snapshot";
import { useUserCommand } from "../hooks/use-user-command";
import { useUserSession } from "../auth/session";
import {
  Back,
  CommandFeedback,
  Feedback,
  PageHeading,
  Panel,
} from "../components/common";
import { ProductIcon } from "../components/product-icon";
import type { Material, MaterialOrder } from "./account-types";
import { safeDownloadUrl } from "./view-policy";
import { materialPurchaseAccess } from "./material-access-policy";
export function MaterialDetail({ id }: Readonly<{ id: string }>) {
  const { actor } = useUserSession();
  return <MaterialDetailContent key={`${actor.userId}:${id}`} id={id} />;
}
function useMaterialDetail(id: string) {
  const query = useUserResource<Material>("materials/" + id),
    { request, actor } = useUserSession(),
    command = useUserCommand(true);
  const material = query.data;
  const orders = useUserSnapshot<MaterialOrder>(
    "me/material-orders?limit=100",
    {
      enabled:
        !!material &&
        material.accessType === "PAID" &&
        material.ownerId !== actor.userId,
      scope: id,
      stopAt: (order) => order.materialId === id && order.status === "SUCCESS",
    },
  );
  const [purchaseRecorded, setPurchaseRecorded] = useState(false);
  const access = materialPurchaseAccess(id, orders.items, {
    ...orders,
    cursor: orders.complete ? null : "checking",
  });
  const purchased = purchaseRecorded || access.purchased;
  const canPurchase = !purchaseRecorded && access.canPurchase;
  const owned = material?.ownerId === actor.userId;
  const [acceptedListing, setAcceptedListing] = useState(""),
    [downloading, setDownloading] = useState(false),
    [confirmDownload, setConfirmDownload] = useState(false),
    [error, setError] = useState<string>();
  const lock = useRef(false);
  const listing = material
    ? material.listingVersion + ":" + material.priceCredit
    : "";
  const agree = !!listing && acceptedListing === listing;
  async function getDownload() {
    if (lock.current) return;
    lock.current = true;
    setDownloading(true);
    setError(undefined);
    try {
      const result = await request<{ url: string; expiresAt: string }>(
        "materials/" + id + "/download",
      );
      if (
        !safeDownloadUrl(result.data.url) ||
        !Number.isFinite(Date.parse(result.data.expiresAt)) ||
        Date.parse(result.data.expiresAt) <= Date.now()
      )
        throw new Error("Liên kết tải chưa hợp lệ.");
      setConfirmDownload(false);
      window.location.assign(result.data.url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Chưa tải được tài liệu.",
      );
    } finally {
      lock.current = false;
      setDownloading(false);
    }
  }
  let accessDescription: string;
  if (owned) accessDescription = "Tài liệu của bạn.";
  else if (purchased) accessDescription = "Bạn đã mua tài liệu này.";
  else accessDescription = "Tài liệu được chia sẻ miễn phí.";
  let purchaseLabel: string;
  if (command.pending) purchaseLabel = "Đang xử lý…";
  else if (command.canRetry) purchaseLabel = "Kiểm tra lại yêu cầu mua";
  else purchaseLabel = "Mua tài liệu";
  return {
    query,
    material,
    orders,
    command,
    request,
    owned,
    purchased,
    canPurchase,
    downloading,
    confirmDownload,
    setConfirmDownload,
    getDownload,
    error,
    agree,
    listing,
    setAcceptedListing,
    setPurchaseRecorded,
    accessDescription,
    purchaseLabel,
  };
}
function MaterialDetailContent({ id }: Readonly<{ id: string }>) {
  const {
    query,
    material,
    orders,
    command,
    request,
    owned,
    purchased,
    canPurchase,
    downloading,
    confirmDownload,
    setConfirmDownload,
    getDownload,
    error,
    agree,
    listing,
    setAcceptedListing,
    setPurchaseRecorded,
    accessDescription,
    purchaseLabel,
  } = useMaterialDetail(id);
  return (
    <>
      <Back href="/learn/materials" />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {material && (
        <>
          <PageHeading
            title={material.title}
            action={
              <span className="learner-status">
                {material.accessType === "FREE" ? "Miễn phí" : "Có phí"}
              </span>
            }
          />
          <div className="learner-two-columns">
            <Panel>
              <div className="product-file-preview">
                <ProductIcon name="file" size={64} />
                <strong>
                  {material.file?.originalFilename ?? material.title}
                </strong>
                <small>{material.file?.mimeType ?? "Tài liệu số"}</small>
              </div>
              <h3>Về tài liệu này</h3>
              <p className="learner-prose">{material.description}</p>
              <p>Phiên bản niêm yết: {material.listingVersion}</p>
              <Link
                className="learner-card-link"
                href={"/learn/reports/new?materialId=" + id}
              >
                Báo cáo nội dung tài liệu
              </Link>
            </Panel>
            <Panel title="Học thêm từ tài liệu">
              <strong className="product-price">
                {material.accessType === "FREE"
                  ? "Miễn phí"
                  : material.priceCredit + " CR"}
              </strong>
              <Feedback
                loading={material.accessType === "PAID" && orders.loading}
                error={orders.error}
                reload={orders.reload}
              />
              {owned || purchased || material.accessType === "FREE" ? (
                <>
                  <p>{accessDescription}</p>
                  {purchased && (
                    <p className="muted">
                      Bắt đầu tải sẽ ghi nhận tài liệu đã sử dụng và kết thúc
                      quyền hoàn đơn tự động.
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={downloading || confirmDownload}
                    onClick={() => {
                      if (purchased) setConfirmDownload(true);
                      else void getDownload();
                    }}
                  >
                    {downloading ? "Đang chuẩn bị tải…" : "Tải tài liệu"}
                  </button>
                  {confirmDownload && (
                    <section
                      className="learner-notice"
                      aria-label="Xác nhận tải tài liệu"
                    >
                      <strong>Bắt đầu sử dụng tài liệu?</strong>
                      <p>
                        Sau bước này, đơn mua không còn đủ điều kiện hoàn tự
                        động, kể cả khi việc tải bị gián đoạn.
                      </p>
                      <div className="learner-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={downloading}
                          onClick={() => void getDownload()}
                        >
                          {downloading
                            ? "Đang chuẩn bị tải…"
                            : "Xác nhận và tải"}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          disabled={downloading}
                          onClick={() => setConfirmDownload(false)}
                        >
                          Để sau
                        </button>
                      </div>
                    </section>
                  )}
                  <Feedback error={error} />
                </>
              ) : (
                <>
                  <p>Sử dụng Credit khả dụng để mua quyền tải tài liệu.</p>
                  <label className="product-consent">
                    <input
                      type="checkbox"
                      checked={agree}
                      disabled={command.pending || command.uncertain}
                      onChange={(e) =>
                        setAcceptedListing(e.target.checked ? listing : "")
                      }
                    />{" "}
                    Tôi đồng ý mua tài liệu với giá {material.priceCredit} CR.
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: 18 }}
                    disabled={!agree || !canPurchase || command.pending}
                    onClick={() => {
                      void command
                        .run(
                          "purchase:" + id + ":" + material.listingVersion,
                          (key) =>
                            request<{ order: MaterialOrder }>(
                              "materials/" + id + "/purchase",
                              {
                                method: "POST",
                                key,
                                body: {
                                  expectedListingVersion:
                                    material.listingVersion,
                                },
                              },
                            ),
                        )
                        .then((result) => {
                          if (
                            result?.data.order?.materialId === id &&
                            result.data.order.status === "SUCCESS"
                          ) {
                            setPurchaseRecorded(true);
                            void orders.reload();
                          }
                        });
                    }}
                  >
                    {purchaseLabel}
                  </button>
                  <CommandFeedback command={command} />
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
