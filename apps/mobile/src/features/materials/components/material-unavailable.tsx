import { useRouter } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { materialStyles as styles } from "./material.styles";

export function MaterialUnavailable({
  owner = false,
}: Readonly<{ owner?: boolean }>) {
  const router = useRouter();
  return (
    <EmptyState
      icon="file"
      title="Tài liệu không còn khả dụng"
      titleStyle={styles.heading}
      description={
        owner
          ? "Tài liệu có thể đã bị xóa hoặc bạn không còn quyền xem. Quay lại danh sách để kiểm tra các tài liệu khác."
          : "Tài liệu có thể đã bị xóa, ngừng chia sẻ hoặc không còn công khai. Nếu đã mua, bạn có thể vào Thư viện để kiểm tra đơn mua và tải tài liệu."
      }
      action={owner ? "Về tài liệu đã đăng" : "Mở Thư viện"}
      onAction={() =>
        router.replace(
          owner ? "/materials/mine?tab=posted" : "/materials/mine?tab=library",
        )
      }
    />
  );
}
