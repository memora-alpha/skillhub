"use client";
import Link from "next/link";
import { useUnreadNotifications } from "../hooks/use-unread-notifications";
import { ProductIcon } from "./product-icon";

export function NotificationBell() {
  const { count, loading, error } = useUnreadNotifications();
  let label = "Thông báo — không có thông báo chưa đọc";
  if (loading) label = "Thông báo — đang tải số thông báo chưa đọc";
  else if (error || count === undefined)
    label = "Thông báo — chưa tải được số thông báo chưa đọc";
  else if (count > 0)
    label = `Thông báo — ${count > 99 ? "hơn 99" : count} thông báo chưa đọc`;
  return (
    <Link
      className="notification-button"
      href="/learn/notifications"
      aria-label={label}
      title={label}
    >
      <ProductIcon name="notification" />
      {count !== undefined && count > 0 && (
        <span className="notification-count" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
