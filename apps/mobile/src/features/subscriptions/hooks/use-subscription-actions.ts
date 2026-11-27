import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useConnections } from "@/features/connections";
import { useToast } from "@/providers/ToastProvider";
import { useSubscriptions } from "../context/subscriptions-provider";
import type {
  Interval,
  Membership,
  Plan,
  SubscriptionUpdate,
} from "../api/subscription-contracts";
import {
  creditLabel,
  dateLabel,
  intervalName,
  planAction,
  planName,
  planPrice,
  subscriptionFailure,
} from "../utils/subscription-presentation";

import type { SubscriptionConfirmation } from "../utils/subscription-confirmation";

export function useSubscriptionActions(membership?: Membership) {
  const { api, model, changed } = useSubscriptions();
  const runtime = useConnections();
  const { showToast } = useToast();
  const [confirmation, setConfirmation] =
    useState<SubscriptionConfirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const active = useRef(false);
  const focusGeneration = useRef(0);
  const request = useRef<AbortController | null>(null);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      focusGeneration.current++;
      setBusy(flight.current);
      return () => {
        active.current = false;
        request.current?.abort();
        setConfirmation(null);
      };
    }, []),
  );
  const isCurrent = () => runtime.isCurrent() && active.current;
  const select = async (plan: Plan, interval: Interval) => {
    if (!membership || flight.current || !isCurrent()) return;
    const current = membership.subscription;
    const action = planAction(plan, interval, current);
    if (action === "purchase") {
      const amount = planPrice(plan, interval);
      setConfirmation({
        kind: "charge",
        title: `Đăng ký ${planName(plan.planCode)}`,
        expectedVersion: null,
        expectedSubscriptionId: null,
        command: {
          kind: "purchase",
          amount,
          body: {
            planCode: plan.planCode,
            interval,
            expectedPlanVersionId: plan.planVersionId,
          },
        },
        description: `Thanh toán ${creditLabel(amount)} cho ${intervalName(interval)} từ Credit khả dụng. Gói tự động gia hạn theo giá có hiệu lực ở kỳ tiếp theo; bạn có thể tắt gia hạn bất cứ lúc nào.`,
      });
    } else if (action === "schedule" && current) {
      setConfirmation({
        kind: "update",
        expectedSubscriptionId: current.id,
        title: "Hẹn đổi gói",
        body: {
          expectedVersion: current.version,
          scheduledPlanCode: plan.planCode,
          scheduledInterval: interval,
        },
        description: `Chuyển sang ${planName(plan.planCode)} · ${intervalName(interval)} ở lần gia hạn tới, theo giá có hiệu lực khi đó. Không trừ Credit ngay.${current.autoRenew ? "" : " Bạn đang tắt gia hạn; cần bật lại để thay đổi có hiệu lực."}`,
      });
    } else if (action === "upgrade" && current) {
      flight.current = true;
      setBusy(true);
      const controller = new AbortController();
      request.current = controller;
      try {
        const quote = await api.quote(plan.planCode, controller.signal);
        if (!isCurrent() || controller.signal.aborted) return;
        setConfirmation({
          kind: "charge",
          title: "Nâng cấp lên Pro",
          expectedVersion: quote.version,
          expectedSubscriptionId: current.id,
          command: {
            kind: "upgrade",
            amount: quote.amount,
            body: {
              planCode: quote.planCode,
              expectedPlanVersionId: quote.planVersionId,
              expectedAmount: quote.amount,
              expectedVersion: quote.version,
            },
          },
          description: `Thanh toán thêm ${creditLabel(quote.amount)} cho thời gian còn lại. Quyền lợi được nâng ngay; ngày hết kỳ vẫn là ${dateLabel(quote.termEnd)}. Thay đổi gói đã hẹn sẽ được bỏ.`,
        });
      } catch (cause) {
        if (isCurrent() && !controller.signal.aborted)
          showToast(subscriptionFailure(cause), "error");
      } finally {
        flight.current = false;
        request.current = null;
        if (isCurrent()) setBusy(false);
      }
    }
  };
  const update = (
    body: SubscriptionUpdate,
    title: string,
    description: string,
  ) => {
    if (!membership?.subscription || flight.current || !isCurrent()) return;
    setConfirmation({
      kind: "update",
      title,
      description,
      body,
      expectedSubscriptionId: membership.subscription.id,
    });
  };
  const confirm = async () => {
    if (!confirmation || flight.current || !isCurrent()) return;
    flight.current = true;
    setBusy(true);
    const initiatedFocus = focusGeneration.current;
    const canNotify = () =>
      isCurrent() && focusGeneration.current === initiatedFocus;
    try {
      if (confirmation.kind === "charge") {
        await model.execute(confirmation.command);
        if (canNotify()) {
          const result = model.getSnapshot();
          if (result.error)
            showToast(subscriptionFailure(result.error), "error");
          else if (result.completed)
            showToast("Gói thành viên đã được cập nhật.", "success");
        }
      } else {
        await api.update(confirmation.body);
        if (runtime.isCurrent()) changed();
        if (canNotify()) {
          showToast("Đã cập nhật gói thành viên.", "success");
        }
      }
      if (canNotify()) setConfirmation(null);
    } catch (cause) {
      // A PATCH may have committed even when its response is lost or the screen blurred.
      if (confirmation.kind === "update" && runtime.isCurrent()) changed();
      if (canNotify()) {
        showToast(subscriptionFailure(cause), "error");
        setConfirmation(null);
      }
    } finally {
      flight.current = false;
      if (isCurrent()) setBusy(false);
    }
  };
  return {
    confirmation,
    busy,
    select,
    update,
    confirm,
    close: () => {
      if (!flight.current) setConfirmation(null);
    },
  };
}
