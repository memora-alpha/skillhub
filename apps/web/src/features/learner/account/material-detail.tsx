"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
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
export function MaterialDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<Material>("materials/" + id),
    orders = useUserResource<MaterialOrder[]>("me/material-orders"),
    { request, actor } = useUserSession(),
    command = useUserCommand(true);
  const material = query.data;
  const purchased = orders.data?.some(
      (order) => order.materialId === id && order.status === "SUCCESS",
    ),
    owned = material?.ownerId === actor.userId;
  const [acceptedListing, setAcceptedListing] = useState(""),
    [downloading, setDownloading] = useState(false),
    [download, setDownload] = useState<{ url: string; expiresAt: string }>(),
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
    setDownload(undefined);
    try {
      const result = await request<{ url: string; expiresAt: string }>(
        "materials/" + id + "/download",
      );
      if (
        !safeDownloadUrl(result.data.url) ||
        !Number.isFinite(Date.parse(result.data.expiresAt))
      )
        throw new Error("Liên kết tải chưa hợp lệ.");
      setDownload(result.data);
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
            eyebrow="THƯ VIỆN TÀI LIỆU"
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
                      Lấy liên kết tải sẽ ghi nhận tài liệu đã được sử dụng và
                      mất quyền hoàn đơn tự động.
                    </p>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={downloading}
                    onClick={() => {
                      void getDownload();
                    }}
                  >
                    {downloading ? "Đang lấy liên kết…" : "Lấy liên kết tải"}
                  </button>
                  {download && (
                    <p>
                      <a
                        className="btn btn-primary"
                        href={download.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Tải tài liệu ↗
                      </a>
                    </p>
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
                    className="btn btn-primary"
                    style={{ marginTop: 18 }}
                    disabled={
                      !agree ||
                      orders.loading ||
                      !!orders.error ||
                      command.pending
                    }
                    onClick={() => {
                      void command
                        .run(
                          "purchase:" + id + ":" + material.listingVersion,
                          (key) =>
                            request("materials/" + id + "/purchase", {
                              method: "POST",
                              key,
                              body: {
                                expectedListingVersion: material.listingVersion,
                              },
                            }),
                        )
                        .then((result) => {
                          if (result) orders.reload();
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
