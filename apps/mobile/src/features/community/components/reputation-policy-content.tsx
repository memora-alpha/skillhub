import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback } from "@/features/connections";
import type { useReputationPolicy } from "../hooks/use-reputation-policy";
import { hasRequestRestriction } from "../utils/reputation-policy";
import { policyStyles as styles } from "./reputation-policy.styles";

export function ReputationPolicyContent({
  policy,
  showAction = true,
}: Readonly<{
  policy: ReturnType<typeof useReputationPolicy>;
  showAction?: boolean;
}>) {
  const { query, data, pending, acknowledged, needsCheck, error } = policy;
  const failed = error ?? query.error;
  return (
    <View style={styles.stack}>
      <ConnectionFeedback
        loading={
          query.isLoading || (!query.isFetchedAfterMount && !query.error)
        }
        loadingPresentation="placeholder"
      />
      {acknowledged && (
        <FormNotice tone="success" compact>
          Đã ghi nhận xác nhận chính sách của bạn.
        </FormNotice>
      )}
      {needsCheck && (
        <FormNotice tone="warning" compact>
          Chưa xác nhận được kết quả. Chọn Thử lại để tải trạng thái mới nhất.
        </FormNotice>
      )}
      {!!failed && (
        <ConnectionFeedback
          error={failed}
          loading={pending || query.isFetching}
          retry={() => policy.refresh()}
        />
      )}
      {data && (
        <>
          {!!data.policyNotice?.length && (
            <View style={styles.section}>
              <Text style={styles.heading}>Quy tắc cần xác nhận</Text>
              <View style={styles.rules}>
                {data.policyNotice.map((rule, index) => (
                  <View key={`${index}:${rule}`} style={styles.rule}>
                    <View style={styles.ruleNumber}>
                      <Text style={styles.number}>{index + 1}</Text>
                    </View>
                    <Text selectable style={styles.ruleText}>
                      {rule}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.footnote}>
                <Text style={styles.note}>
                  Xác nhận ngay để hoàn tất bước này. Quyền đăng bài được khôi
                  phục sau khi hết thời hạn và đáp ứng đủ điều kiện.
                </Text>
              </View>
            </View>
          )}
          {!data.policyNotice?.length &&
            query.isFetchedAfterMount &&
            !failed &&
            !query.isFetching && (
              <FormNotice
                tone={hasRequestRestriction(data) ? "info" : "success"}
                compact
              >
                {hasRequestRestriction(data)
                  ? "Tài khoản vẫn đang bị hạn chế. Kiểm tra lý do và thời hạn trong mục Uy tín; xác nhận chính sách không rút ngắn thời gian hạn chế."
                  : "Hệ thống không còn ghi nhận hạn chế tạo yêu cầu học. Bạn có thể quay lại và chủ động lưu hoặc đăng lại bài."}
              </FormNotice>
            )}
          {data.policyNotice === undefined && hasRequestRestriction(data) && (
            <Text style={styles.note}>
              Chưa tải được thông tin xác nhận chính sách. Bạn có thể mở lại mục
              Uy tín hoặc liên hệ hỗ trợ nếu vẫn bị chặn khi đã hết hạn.
            </Text>
          )}
          {showAction && <ReputationPolicyAction policy={policy} />}
        </>
      )}
    </View>
  );
}

export function ReputationPolicyAction({
  policy,
}: Readonly<{ policy: ReturnType<typeof useReputationPolicy> }>) {
  const { query, data, pending, acknowledged, needsCheck, error } = policy;
  if (!data?.policyNotice?.length || acknowledged || needsCheck) return null;
  return (
    <Button
      variant="craft"
      disabled={pending || query.isFetching || !!error || !!query.error}
      onPress={() => void policy.acknowledge()}
    >
      {pending ? "Đang xác nhận…" : "Tôi đã đọc và hiểu chính sách"}
    </Button>
  );
}
