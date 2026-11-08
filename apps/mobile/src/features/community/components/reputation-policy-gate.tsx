import { useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { InfoModal } from "@/components/InfoModal";
import { useReputationPolicy } from "../hooks/use-reputation-policy";
import { hasRequestRestriction } from "../utils/reputation-policy";
import {
  ReputationPolicyContent,
  ReputationPolicyAction,
} from "./reputation-policy-content";
import { ReputationSummary } from "./reputation-summary";
import { policyStyles as styles } from "./reputation-policy.styles";

export function ReputationPolicyGate({
  message,
  pending,
}: Readonly<{ message: string; pending: boolean }>) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const policy = useReputationPolicy(open);
  const cleared =
    policy.data &&
    policy.query.isFetchedAfterMount &&
    !policy.query.error &&
    !policy.error &&
    !policy.needsCheck &&
    !policy.pending &&
    !policy.query.isFetching &&
    !hasRequestRestriction(policy.data) &&
    !policy.data.policyNotice?.length;
  return (
    <View style={{ gap: 8 }}>
      <FormNotice tone={cleared ? "success" : "error"}>
        {cleared
          ? "Không còn hạn chế tạo yêu cầu học. Nội dung đang nhập được giữ nguyên; bạn có thể thử lưu hoặc đăng lại."
          : policy.acknowledged && !policy.error && !policy.query.error
            ? "Đã xác nhận chính sách. Tài khoản vẫn đang bị hạn chế; xem thời hạn và trạng thái mới nhất trước khi đăng lại."
            : message}
      </FormNotice>
      <Button
        variant="paper"
        disabled={pending || policy.pending}
        onPress={() => setOpen(true)}
      >
        Đọc chính sách và kiểm tra hạn chế
      </Button>
      <Button
        variant="ghost"
        disabled={pending || policy.pending}
        onPress={() => router.push("/reputation")}
      >
        Xem uy tín và hạn chế
      </Button>
      <InfoModal
        title={open ? "Quy định đăng bài" : null}
        showConfirm={false}
        titleStyle={styles.modalTitle}
        style={styles.modal}
        footer={open ? <ReputationPolicyAction policy={policy} /> : undefined}
        busy={policy.pending}
        onClose={() => setOpen(false)}
      >
        {open &&
          policy.data &&
          policy.query.isFetchedAfterMount &&
          !policy.query.error && <ReputationSummary data={policy.data} />}
        {open && <ReputationPolicyContent policy={policy} showAction={false} />}
      </InfoModal>
    </View>
  );
}
