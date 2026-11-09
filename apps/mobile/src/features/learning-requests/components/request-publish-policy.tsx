import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback } from "@/features/connections";
import type { CreationPolicy } from "./request-creation-gate";

export function RequestPublishPolicy({
  policy,
}: Readonly<{ policy: CreationPolicy }>) {
  const router = useRouter();
  const error = policy.query.error ?? policy.error;
  const loading =
    policy.pending ||
    policy.query.isFetching ||
    (!policy.query.isFetchedAfterMount && !error && !policy.query.denied);
  return (
    <View style={{ gap: 8 }}>
      <ConnectionFeedback
        loading={loading}
        loadingPresentation="inline"
        error={error}
        retry={() => policy.refresh()}
      />
      {!loading && !error && (
        <FormNotice tone="warning" compact>
          {policy.query.denied || !policy.data || policy.needsCheck
            ? "Chưa xác nhận được quyền đăng bài. Hãy mở mục Uy tín để kiểm tra trước khi đăng."
            : "Tài khoản đang bị hạn chế đăng yêu cầu học. Xem lý do, thời hạn và chính sách cần xác nhận trong mục Uy tín. Bạn vẫn có thể chỉnh sửa hoặc hủy bản nháp."}
        </FormNotice>
      )}
      {!loading && (
        <Button variant="ghost" onPress={() => router.push("/reputation")}>
          Xem uy tín và hạn chế
        </Button>
      )}
    </View>
  );
}
