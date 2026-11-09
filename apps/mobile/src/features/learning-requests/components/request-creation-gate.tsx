import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import {
  useReputationPolicy,
  canCreateRequest,
  hasRequestRestriction,
  ReputationSummary,
  ReputationPolicyContent,
} from "@/features/community/policy";
import { ConnectionFeedback } from "@/features/connections";
import { FormNotice } from "@/components/FormNotice";
import { appColors, fonts, typography } from "@/constants/theme";
import { RequestPage } from "./request-page";

export type CreationPolicy = ReturnType<typeof useReputationPolicy>;

export function RequestCreationFeedback({
  policy,
}: Readonly<{ policy: CreationPolicy }>) {
  const fresh = policy.query.isFetchedAfterMount && !policy.query.error;
  return (
    <View style={{ gap: 16 }}>
      <Text
        style={{
          ...typography.body,
          fontFamily: fonts.body,
          color: appColors.body,
        }}
      >
        Kiểm tra hạn chế tài khoản trước khi soạn yêu cầu học.
      </Text>
      <ConnectionFeedback
        loading={
          policy.query.isLoading ||
          (!policy.query.isFetchedAfterMount && !policy.query.error)
        }
        error={policy.query.error}
        retry={() => policy.refresh()}
      />
      {fresh &&
        policy.data &&
        (hasRequestRestriction(policy.data) ||
          !!policy.error ||
          policy.needsCheck) && (
          <>
            {hasRequestRestriction(policy.data) && (
              <FormNotice tone="warning" compact>
                Tài khoản hiện chưa thể tạo yêu cầu học. Xem lý do và hoàn tất
                các bước cần thiết bên dưới trước khi bắt đầu soạn bài.
              </FormNotice>
            )}
            <ReputationSummary data={policy.data} />
            <ReputationPolicyContent policy={policy} />
          </>
        )}
    </View>
  );
}

export function RequestCreationGate({
  children,
}: Readonly<{
  children: (policy: CreationPolicy) => ReactNode;
}>) {
  const policy = useReputationPolicy();
  const allowed = canCreateRequest(policy);
  const [admitted, setAdmitted] = useState(false);
  useEffect(() => {
    if (allowed) setAdmitted(true);
  }, [allowed]);
  // Once mounted, keep the form/draft alive when a later read changes access.
  if (admitted || allowed) return children(policy);
  return (
    <RequestPage title="Tạo yêu cầu học" fallback="/discover">
      <RequestCreationFeedback policy={policy} />
    </RequestPage>
  );
}
