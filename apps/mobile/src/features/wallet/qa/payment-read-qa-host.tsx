import { useEffect, useMemo, useState } from "react";
import { AppState, ScrollView } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuthSession } from "@/features/auth";
import type { PaymentQaBinding } from "@/qa/payment-qa-binding";
import { useQaRuntime } from "./use-qa-runtime";
import {
  paymentPolicyOptions,
  projectPaymentPolicy,
} from "../utils/payment-policy-query";
import {
  paymentReadOptions,
  projectPaymentRead,
  pausePaymentRead,
} from "../utils/payment-read-query";
import { paymentStatusPresentation } from "../utils/payment-status-presentation";
import { PaymentStatusPanel } from "../components/payment-status-panel";
import { Copy, ui } from "../components/wallet-ui";
import { useQaRelatedRefresh } from "./use-qa-related-refresh";

export function PaymentReadQaHost({ binding }: { binding: PaymentQaBinding }) {
  const runtime = useQaRuntime(binding),
    queries = useQueryClient();
  const { signOut } = useAuthSession();
  const [id, setId] = useState(""),
    [active, setActive] = useState(AppState.currentState !== "background");
  const policyOptions = useMemo(
    () =>
      paymentPolicyOptions(
        runtime,
        runtime?.client ?? null,
        queries,
        binding.environment,
      ),
    [runtime, queries, binding.environment],
  );
  const policyQuery = useQuery({
    ...policyOptions,
    enabled: !!policyOptions.enabled && active,
  });
  const policy = projectPaymentPolicy(
    runtime,
    policyQuery.data,
    policyQuery.error,
    policyQuery.isFetching,
  );
  const options = paymentReadOptions(
    runtime,
    runtime?.client ?? null,
    id,
    queries,
  );
  const query = useQuery({ ...options, enabled: !!options.enabled && active });
  const state = projectPaymentRead(runtime, id, query),
    related = useQaRelatedRefresh(runtime, state.data, active);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (s) => {
      setActive(s === "active");
      if (s !== "active") {
        void pausePaymentRead(queries, runtime, id);
        void queries.cancelQueries({ queryKey: policyOptions.queryKey });
      } else {
        if (options.enabled) void query.refetch({ cancelRefetch: false });
        if (policyOptions.enabled)
          void policyQuery.refetch({ cancelRefetch: false });
      }
    });
    return () => {
      listener.remove();
      void pausePaymentRead(queries, runtime, id);
    };
  }, [queries, runtime, id, policyOptions.queryKey]);
  return (
    <ScrollView
      contentContainerStyle={ui.page}
      keyboardShouldPersistTaps="handled"
    >
      <Copy>QA · OWNER READS · {binding.buildId}</Copy>
      <Copy>
        {policy.status}
        {policy.data?.canCreate
          ? " · Cho phép yêu cầu mới (snapshot)"
          : " · Chưa cho phép yêu cầu mới"}
      </Copy>
      {policy.data?.existingPaymentId && (
        <Button
          variant="paper"
          onPress={() => setId(policy.data!.existingPaymentId!)}
        >
          Kiểm tra yêu cầu đang mở
        </Button>
      )}
      <Input
        label="Payment UUID của tài khoản QA"
        value={id}
        onChangeText={setId}
        autoCapitalize="none"
      />
      <PaymentStatusPanel
        state={paymentStatusPresentation(state)}
        onCheck={
          options.enabled
            ? () => {
                void query.refetch({ cancelRefetch: false });
              }
            : undefined
        }
        refresh={related.state}
        onRefresh={related.refresh}
      />
      <Button
        variant="ghost"
        onPress={() => {
          void signOut();
        }}
      >
        Thoát QA và đăng xuất
      </Button>
    </ScrollView>
  );
}
