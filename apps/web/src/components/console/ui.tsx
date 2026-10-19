"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "brand";

export function PageHeader({
  title,
  desc,
  actions,
  back,
}: {
  title: string;
  desc?: string;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="page-head">
      <title>{`${title} · SkillHub`}</title>
      <div>
        {back}
        <h1>{title}</h1>
        {desc && <p className="muted">{desc}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  actions,
  flush,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  flush?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      <div className={flush ? "card-flush" : "card-body"}>{children}</div>
    </section>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// One lookup for every enum in the API. Labels are always shown, colour is secondary.
const STATUS: Record<string, [string, Tone]> = {
  ACTIVE: ["Hoạt động", "ok"],
  PENDING_VERIFICATION: ["Chờ xác minh", "warn"],
  SUSPENDED: ["Tạm đình chỉ", "warn"],
  LOCKED: ["Đã khóa", "bad"],
  DEACTIVATED: ["Đã vô hiệu", "neutral"],
  INACTIVE: ["Tạm ngưng", "neutral"],
  ARCHIVED: ["Đã ẩn", "neutral"],
  PENDING: ["Chờ duyệt", "warn"],
  APPROVED: ["Đã duyệt", "ok"],
  REJECTED: ["Từ chối", "bad"],
  PENDING_MODERATION: ["Chờ kiểm duyệt", "warn"],
  PENDING_REVIEW: ["Chờ duyệt", "warn"],
  PUBLISHED: ["Đã đăng", "ok"],
  OPEN: ["Mới", "info"],
  UNDER_REVIEW: ["Đang xem xét", "warn"],
  NEED_MORE_INFO: ["Cần bổ sung", "warn"],
  RESOLVED: ["Đã xử lý", "ok"],
  CLOSED: ["Đã đóng", "neutral"],
  NEGOTIATING: ["Đang thương lượng", "info"],
  DISPUTED: ["Tranh chấp", "bad"],
  AWAITING_CONFIRMATION: ["Chờ xác nhận", "warn"],
  COMPLETED: ["Hoàn thành", "ok"],
  SUCCESS: ["Thành công", "ok"],
  FAILED: ["Thất bại", "bad"],
  REVERSED: ["Đã hoàn tác", "neutral"],
  PAID: ["Đã thanh toán", "ok"],
  CREATED: ["Mới tạo", "neutral"],
  EXPIRED: ["Hết hạn", "neutral"],
  REFUNDED: ["Đã hoàn tiền", "info"],
  HIGH: ["Ưu tiên cao", "bad"],
  NORMAL: ["Bình thường", "neutral"],
  CLEAN: ["Quét sạch", "ok"],
  SUSPICIOUS: ["Nghi vấn", "bad"],
  FREE: ["Miễn phí", "ok"],
  PAID_MATERIAL: ["Trả phí", "brand"],
  HIDDEN: ["Đang ẩn", "neutral"],
  VISIBLE: ["Hiển thị", "ok"],
  USER: ["USER", "neutral"],
  STAFF: ["STAFF", "info"],
  ADMIN: ["ADMIN", "brand"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = STATUS[status] ?? [status, "neutral" as Tone];
  return <Badge tone={tone}>{label}</Badge>;
}

export function Stat({
  label,
  value,
  icon,
  delta,
  hint,
}: {
  label: string;
  value: string;
  icon: IconName;
  delta?: number;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <Icon name={icon} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        {delta !== undefined && (
          <span className={delta >= 0 ? "delta-up" : "delta-down"}>
            <Icon name={delta >= 0 ? "arrowUp" : "arrowDown"} size={14} />
            {Math.abs(delta)}%
          </span>
        )}
        {hint && <span className="muted">{hint}</span>}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="search">
      <span className="sr-only">{label}</span>
      <Icon name="search" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function Empty({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="empty">
      <Icon name="inbox" size={28} />
      <strong>{title}</strong>
      {desc && <span className="muted">{desc}</span>}
    </div>
  );
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {name.split(" ").at(-1)?.[0]}
    </span>
  );
}

export function Notice({
  tone = "info",
  icon = "info",
  children,
}: {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <div className={`notice notice-${tone}`} role="note">
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

/** Permission-gated button: stays visible but disabled, with the reason on hover/focus. */
export function GatedButton({
  allowed,
  className = "btn",
  children,
  title,
  disabled,
  ...rest
}: {
  allowed: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={className}
      disabled={!allowed || disabled}
      title={allowed ? title : "Bạn không có quyền thực hiện thao tác này"}
    >
      {children}
    </button>
  );
}
