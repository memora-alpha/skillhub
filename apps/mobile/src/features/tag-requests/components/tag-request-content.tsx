import { Copy, RouteButton } from "@/components/feature-page";
import { tagRequestLabels, type TagRequest } from "../api/tag-requests-api";

export function TagRequestContent({
  request,
}: Readonly<{ request: TagRequest }>) {
  const format = (value: string) =>
    new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(value));
  return (
    <>
      <Copy>{tagRequestLabels[request.status]}</Copy>
      <Copy muted>Gửi lúc {format(request.createdAt)} (giờ Việt Nam)</Copy>
      {request.reviewedAt && (
        <Copy muted>Xử lý lúc {format(request.reviewedAt)}</Copy>
      )}
      {!!request.rejectReason && (
        <Copy>Lý do từ chối: {request.rejectReason}</Copy>
      )}
      {request.status === "APPROVED" && (
        <>
          <Copy>
            Tag đã được duyệt. Tìm và chọn tag còn hiệu lực khi soạn bài nhu cầu
            học.
          </Copy>
          <RouteButton secondary href="/requests/new">
            Tạo bài nhu cầu học
          </RouteButton>
        </>
      )}
    </>
  );
}
