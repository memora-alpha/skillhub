"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { UserApiError } from "../api/client";
import {
  Empty,
  Feedback,
  PageHeading,
  Panel,
  formatTime,
} from "../components/common";
import { safeDownloadUrl } from "../account/view-policy";
import {
  parseRewardIntent,
  redemptionLabels,
  redemptionMetadata,
  type RewardIntent,
  type RewardProduct,
  type Redemption,
  type VoucherSecret,
} from "./reward-contract";

export function VouchersScreen({
  productId,
  redemptionId,
}: Readonly<{ productId?: string; redemptionId?: string }>) {
  const { actor } = useUserSession();
  return (
    <VoucherWorkspace
      key={actor.userId}
      productId={productId}
      redemptionId={redemptionId}
    />
  );
}

function VoucherWorkspace({
  productId,
  redemptionId,
}: Readonly<{ productId?: string; redemptionId?: string }>) {
  const { request, actor, refresh } = useUserSession();
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const allCatalog = useUserResource<RewardProduct[]>(
    "rewards/products?locale=vi",
  );
  const catalogParams = new URLSearchParams({ locale: "vi" });
  if (brand) catalogParams.set("brandId", brand);
  if (category) catalogParams.set("category", category);
  const filteredCatalog = useUserResource<RewardProduct[]>(
    brand || category ? `rewards/products?${catalogParams}` : null,
  );
  const catalog = brand || category ? filteredCatalog : allCatalog;
  const product = useUserResource<RewardProduct>(
    productId ? `rewards/products/${productId}?locale=vi` : null,
  );
  const history = useUserPagedList<Redemption>("rewards/redemptions?limit=20");
  const [intent, setIntent] = useState<RewardIntent | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState("");
  const [resultId, setResultId] = useState(redemptionId);
  const [created, setCreated] = useState<Redemption>();
  const lock = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const storageKey = `skillhub:reward-intent:${actor.userId}`;
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const restore = () => {
      if (controller.signal.aborted) return;
      try {
        setIntent(
          parseRewardIntent(localStorage.getItem(storageKey), actor.userId),
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Không thể đọc yêu cầu đã lưu.",
        );
      }
      setReady(true);
    };
    void Promise.resolve().then(restore);
    window.addEventListener("storage", restore);
    return () => {
      controller.abort();
      window.removeEventListener("storage", restore);
    };
  }, [storageKey, actor.userId]);
  async function execute(recovery: boolean, chosen?: RewardProduct) {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    setNotice("");
    const work = async () => {
      let pending = parseRewardIntent(
        localStorage.getItem(storageKey),
        actor.userId,
      );
      if (recovery) {
        if (!pending) return;
      } else {
        if (pending) {
          setIntent(pending);
          throw new Error(
            "Kiểm tra yêu cầu đã lưu trước khi đổi voucher khác.",
          );
        }
        if (!chosen) return;
        pending = {
          userId: actor.userId,
          key: crypto.randomUUID(),
          productId: chosen.id,
          expectedPriceVersion: chosen.priceVersion,
        };
        localStorage.setItem(storageKey, JSON.stringify(pending));
        setIntent(pending);
      }
      const signal = lifetime.current?.signal;
      try {
        const reply = await request<Redemption>(
          recovery ? "rewards/redemptions/lookup" : "rewards/redemptions",
          {
            method: "POST",
            key: pending!.key,
            signal,
            ...(recovery
              ? {}
              : {
                  body: {
                    productId: pending!.productId,
                    expectedPriceVersion: pending!.expectedPriceVersion,
                  },
                }),
          },
        );
        const metadata = redemptionMetadata(reply.data);
        if (metadata.product.id !== pending!.productId)
          throw new Error(
            "Kết quả không khớp voucher đã chọn. Giữ yêu cầu đã lưu để kiểm tra.",
          );
        if (signal?.aborted) return;
        localStorage.removeItem(storageKey);
        setIntent(null);
        setCreated(metadata);
        setResultId(metadata.id);
        setNotice(
          "Đã ghi nhận yêu cầu. Theo dõi trạng thái trong lịch sử đổi thưởng.",
        );
        history.reload();
        if (productId) product.reload();
        allCatalog.reload();
        if (brand || category) filteredCatalog.reload();
        refresh();
      } catch (cause) {
        if (signal?.aborted) return;
        if (
          recovery &&
          cause instanceof UserApiError &&
          cause.status === 404 &&
          cause.code === "VOUCHER_REDEMPTION_NOT_FOUND"
        ) {
          localStorage.removeItem(storageKey);
          setIntent(null);
          if (productId) product.reload();
          allCatalog.reload();
          if (brand || category) filteredCatalog.reload();
          setNotice(
            "Máy chủ xác nhận yêu cầu cũ không phát sinh đổi thưởng. Bạn có thể chọn lại voucher.",
          );
        } else throw cause;
      }
    };
    try {
      if (navigator.locks) await navigator.locks.request(storageKey, work);
      else await work();
    } catch (cause) {
      if (!lifetime.current?.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Chưa xác định được kết quả. Kiểm tra lại yêu cầu đã lưu.",
        );
    } finally {
      lock.current = false;
      if (!lifetime.current?.signal.aborted) setBusy(false);
    }
  }
  const products = catalog.data ?? [];
  return (
    <>
      <PageHeading
        title="Voucher & phần thưởng"
        description="Dùng Credit khả dụng để đổi voucher. Giá và hạn mức được máy chủ kiểm tra khi xác nhận."
      />
      <Feedback error={error} />
      {notice && <output className="learner-notice">{notice}</output>}
      {intent && (
        <Panel title="Có yêu cầu cần kiểm tra">
          <p>
            Yêu cầu đã lưu được giữ qua lần đóng trình duyệt. Kiểm tra kết quả
            trước khi đổi tiếp để tránh gửi trùng.
          </p>
          <LoadingButton
            type="button"
            className="btn btn-primary"
            loading={busy}
            onClick={() => void execute(true)}
          >
            Kiểm tra yêu cầu đã lưu
          </LoadingButton>
        </Panel>
      )}
      {productId ? (
        <>
          <Link href="/learn/vouchers" className="btn">
            ← Danh mục voucher
          </Link>
          <Feedback
            loading={product.initialLoading}
            error={product.error}
            reload={product.reload}
          />
          {product.data && (
            <ProductDetails
              key={product.data.id + ":" + product.data.priceVersion}
              product={product.data}
              disabled={!ready || busy || !!intent}
              busy={busy}
              redeem={() => void execute(false, product.data)}
            />
          )}
        </>
      ) : (
        <Panel title="Danh mục voucher">
          <div className="learner-actions">
            <label>
              Thương hiệu
              <select
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
              >
                <option value="">Tất cả</option>
                {[
                  ...new Map(
                    (allCatalog.data ?? []).map((row) => [
                      row.brand.id,
                      row.brand,
                    ]),
                  ).values(),
                ].map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Danh mục
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">Tất cả</option>
                {[
                  ...new Set(
                    (allCatalog.data ?? [])
                      .map((row) => row.category)
                      .filter(Boolean),
                  ),
                ].map((value) => (
                  <option key={value!} value={value!}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Feedback
            loading={catalog.initialLoading}
            error={catalog.error}
            reload={catalog.reload}
          />
          {products.map((row) => (
            <article className="learner-card" key={row.id}>
              <h3>{row.name}</h3>
              <p>
                {row.brand.name} · {row.faceValueVnd} VND · {row.priceCredit}{" "}
                Credit
              </p>
              <Link className="btn" href={`/learn/vouchers/${row.id}`}>
                Xem điều kiện & đổi voucher
              </Link>
            </article>
          ))}
          {!catalog.loading && !catalog.error && !products.length && (
            <Empty>Chưa có voucher phù hợp.</Empty>
          )}
        </Panel>
      )}
      {resultId && (
        <RedemptionDetails
          key={resultId}
          id={resultId}
          known={
            history.allItems.find((row) => row.id === resultId) ??
            (created?.id === resultId ? created : undefined)
          }
          reload={history.reload}
        />
      )}
      <Panel title="Lịch sử đổi thưởng">
        <Feedback
          loading={history.initialLoading}
          error={history.error}
          reload={history.reload}
        />
        {history.items.map((row) => (
          <article key={row.id}>
            <h3>{row.product.name}</h3>
            <p>
              {redemptionLabels[row.status] ?? row.status} · {row.priceCredit}{" "}
              Credit · {formatTime(row.createdAt)}
            </p>
            <Link className="btn" href={`/learn/vouchers/mine/${row.id}`}>
              Xem kết quả / mã voucher
            </Link>
          </article>
        ))}
        <ListPagination query={history} />
      </Panel>
    </>
  );
}

function ProductDetails({
  product,
  disabled,
  busy,
  redeem,
}: Readonly<{
  product: RewardProduct;
  disabled: boolean;
  busy: boolean;
  redeem: () => void;
}>) {
  return (
    <Panel title={product.name}>
      <p>
        {product.brand.name} · Mệnh giá {product.faceValueVnd} VND
      </p>
      <p>
        Giá đổi: <strong>{product.priceCredit} Credit</strong>
      </p>
      {product.terms && <p className="learner-prose">{product.terms}</p>}
      {product.validityDays !== null && (
        <p>
          Thời hạn sử dụng: {product.validityDays} ngày theo điều kiện nhà cung
          cấp.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled) redeem();
        }}
      >
        <label>
          <input type="checkbox" required disabled={disabled} /> Tôi đã kiểm tra
          giá và điều kiện voucher này.
        </label>
        <LoadingButton
          type="submit"
          className="btn btn-primary"
          disabled={disabled}
          loading={busy}
        >
          Xác nhận đổi {product.priceCredit} Credit
        </LoadingButton>
      </form>
    </Panel>
  );
}

function RedemptionDetails({
  id,
  known,
  reload,
}: Readonly<{
  id: string;
  known?: Redemption;
  reload: () => void;
}>) {
  const { request } = useUserSession();
  const [fetched, setFetched] = useState<Redemption>();
  const [secret, setSecret] = useState<VoucherSecret>();
  const [error, setError] = useState<string>();
  const [revealing, setRevealing] = useState(false);
  const revealLock = useRef(false);
  const active = useRef<AbortController | null>(null);
  // Metadata lấy từ danh sách để không gọi chi tiết (BE ghi audit VOUCHER_REVEAL mỗi lần GET chi tiết).
  const metadata = known ?? fetched;
  const pending =
    !!metadata && ["ISSUING", "MANUAL_REVIEW"].includes(metadata.status);
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    const hide = () => setSecret(undefined);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", hide);
    return () => {
      controller.abort();
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [request, id]);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [pending, reload]);
  useEffect(() => {
    if (!secret) return;
    const timer = setTimeout(() => setSecret(undefined), 30000);
    return () => clearTimeout(timer);
  }, [secret]);
  async function reveal() {
    if (revealLock.current || !active.current || document.hidden) return;
    revealLock.current = true;
    setRevealing(true);
    setError(undefined);
    try {
      const reply = await request<Redemption>(`rewards/redemptions/${id}`, {
        signal: active.current.signal,
      });
      if (
        !active.current.signal.aborted &&
        !document.hidden &&
        document.hasFocus()
      ) {
        setFetched(redemptionMetadata(reply.data));
        setSecret(reply.data.voucher ?? undefined);
      }
    } catch (cause) {
      if (!active.current.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Chưa xem được mã voucher.",
        );
    } finally {
      revealLock.current = false;
      if (!active.current.signal.aborted) setRevealing(false);
    }
  }
  return (
    <Panel title={metadata?.product.name ?? "Kết quả đổi thưởng"}>
      <Feedback error={error} />
      {metadata && (
        <>
          <p>
            {redemptionLabels[metadata.status] ?? metadata.status} ·{" "}
            {metadata.priceCredit} Credit
          </p>
          {metadata.expiresAt && (
            <p>Hết hạn: {formatTime(metadata.expiresAt)}</p>
          )}
        </>
      )}
      {(!metadata || metadata.status === "ISSUED") && (
        <LoadingButton
          type="button"
          className="btn btn-primary"
          loading={revealing}
          onClick={() => (secret ? setSecret(undefined) : void reveal())}
        >
          {secret
            ? "Ẩn mã voucher"
            : metadata
              ? "Xem mã voucher"
              : "Xem kết quả / mã voucher"}
        </LoadingButton>
      )}
      {secret && (
        <div aria-label="Thông tin voucher">
          <p>
            Mã: <code>{secret.code || "Không có"}</code>
          </p>
          {secret.pin && (
            <p>
              PIN: <code>{secret.pin}</code>
            </p>
          )}
          {safeDownloadUrl(secret.link) && (
            <a
              href={secret.link}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Mở voucher của nhà cung cấp
            </a>
          )}
          <small>Mã tự ẩn sau 30 giây hoặc khi rời màn hình.</small>
        </div>
      )}
    </Panel>
  );
}
