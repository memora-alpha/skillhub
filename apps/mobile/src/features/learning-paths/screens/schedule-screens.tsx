import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { DataForm, integerRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { usePathsPreview } from "../context";
import { agreementConfirmed, validSlots, finalValidation } from "../rules";
import { futureSlot } from "../fixtures";
import { parseLocalDateTime } from "@/utils/local-date-time";
import { useSessionsPreview } from "@/features/sessions/state";
export function SchedulesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paths, save } = usePathsPreview();
  const path = paths.find((p) => p.id === id);
  const enabled =
    path && agreementConfirmed(path) && path.status === "PROPOSED";
  return (
    <FeaturePage title="Lịch của từng kế hoạch" back={`/paths/${id}`}>
      {!path ? (
        <EmptyState
          title="Không tìm thấy lộ trình"
          description="Lộ trình không có trong bản xem thử."
        />
      ) : (
        <>
          {!enabled && (
            <FormNotice tone="info">
              Chỉ tạo lịch sau khi đủ kế hoạch, người học xác nhận và hai bên
              xác nhận điều khoản chung cùng phiên bản.
            </FormNotice>
          )}
          {path.plans.map((plan) => (
            <Panel key={plan.id} title={plan.skill}>
              <Copy>
                {plan.outline.length} buổi · lịch gắn kế hoạch {plan.id}
              </Copy>
              {plan.schedule ? (
                <>
                  <Copy>Phiên bản lịch {plan.schedule.version}</Copy>
                  {plan.schedule.slots.map((s, i) => (
                    <Copy key={i}>
                      Buổi {i + 1}:{" "}
                      {new Date(s.startAt).toLocaleString("vi-VN")} ·{" "}
                      {s.duration} phút
                    </Copy>
                  ))}
                  <Copy>
                    Bạn:{" "}
                    {plan.schedule.meVersion === plan.schedule.version
                      ? "Đã xác nhận"
                      : "Chưa xác nhận"}{" "}
                    · Đối tác:{" "}
                    {plan.schedule.partnerVersion === plan.schedule.version
                      ? "Đã xác nhận"
                      : "Chưa xác nhận"}
                  </Copy>
                  <Button
                    disabled={
                      !enabled ||
                      plan.schedule.meVersion === plan.schedule.version
                    }
                    onPress={() =>
                      save({
                        ...path,
                        plans: path.plans.map((p) =>
                          p.id === plan.id && p.schedule
                            ? {
                                ...p,
                                schedule: {
                                  ...p.schedule,
                                  meVersion: p.schedule.version,
                                },
                              }
                            : p,
                        ),
                      })
                    }
                  >
                    Xác nhận lịch v{plan.schedule.version}
                  </Button>
                </>
              ) : (
                <Copy muted>Chưa có đề xuất lịch.</Copy>
              )}
              {enabled && plan.teacher === "me" && (
                <RouteButton
                  secondary
                  href={`/paths/${id}/schedules/${plan.id}`}
                >
                  {plan.schedule
                    ? "Sửa lịch tôi đề xuất"
                    : "Đề xuất lịch tôi dạy"}
                </RouteButton>
              )}
              {!plan.schedule && plan.teacher !== "me" && (
                <Copy muted>Chờ người dạy của kế hoạch này đề xuất lịch.</Copy>
              )}
            </Panel>
          ))}
          <RouteButton href={`/paths/${id}/hold`}>
            Kiểm tra trước khi khóa lịch
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
function localDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function ScheduleEditorScreen() {
  const { id, planId } = useLocalSearchParams<{ id: string; planId: string }>();
  const { paths, save } = usePathsPreview();
  const router = useRouter();
  const path = paths.find((p) => p.id === id);
  const plan = path?.plans.find((p) => p.id === planId);
  const enabled =
    path &&
    plan &&
    plan.teacher === "me" &&
    agreementConfirmed(path) &&
    path.status === "PROPOSED";
  const defaults = Object.fromEntries(
    (plan?.outline ?? []).flatMap((_, i) => [
      [
        `start${i}`,
        localDate(plan?.schedule?.slots[i]?.startAt ?? futureSlot(i + 1)),
      ],
      [`duration${i}`, String(plan?.schedule?.slots[i]?.duration ?? 90)],
    ]),
  );
  return (
    <FeaturePage title="Đề xuất lịch" back={`/paths/${id}/schedules`}>
      {!enabled ? (
        <EmptyState
          title="Chưa thể tạo lịch"
          description="Cần đủ xác nhận và bạn phải là người dạy của kế hoạch này."
        />
      ) : (
        <Panel title={plan.skill}>
          <DataForm
            defaults={defaults}
            fields={plan.outline.flatMap((lesson, i) => [
              {
                name: `start${i}`,
                label: `Buổi ${i + 1} · ${lesson}`,
                rule: z
                  .string()
                  .refine(
                    (v) => !!parseLocalDateTime(v),
                    "Nhập YYYY-MM-DDTHH:mm hợp lệ.",
                  ),
                hint: `Giờ địa phương (${Intl.DateTimeFormat().resolvedOptions().timeZone}). Ví dụ 2026-10-20T19:00.`,
              },
              {
                name: `duration${i}`,
                label: "Thời lượng (phút)",
                rule: integerRule(60, 180),
                numeric: true,
              },
            ])}
            submitLabel="Gửi lịch mẫu mới"
            onSubmit={(v) => {
              const slots = plan.outline.map((_, i) => ({
                startAt: parseLocalDateTime(v[`start${i}`]!)!.toISOString(),
                duration: Number(v[`duration${i}`]),
              }));
              const error = validSlots(slots, plan.outline.length);
              if (error) return error;
              save({
                ...path,
                plans: path.plans.map((p) =>
                  p.id === planId
                    ? {
                        ...p,
                        schedule: {
                          slots,
                          version: (p.schedule?.version ?? 0) + 1,
                        },
                      }
                    : p,
                ),
              });
              router.replace(`/paths/${id}/schedules`);
            }}
          />
        </Panel>
      )}
    </FeaturePage>
  );
}
export function HoldScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paths, save } = usePathsPreview();
  const { sessions } = useSessionsPreview();
  const occupied = sessions
    .filter(
      (s) => s.pathId !== id && ["CONFIRMED", "DISPUTED"].includes(s.status),
    )
    .map((s) => ({ startAt: s.startAt, duration: s.duration }));
  const path = paths.find((p) => p.id === id);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <FeaturePage title="Kiểm tra & tạm giữ Credit" back={`/paths/${id}`}>
      {!path ? (
        <EmptyState
          title="Không tìm thấy lộ trình"
          description="Không thể kiểm tra thỏa thuận."
        />
      ) : path.status === "ACTIVE" ? (
        <Panel title="Lịch mẫu đã khóa">
          <Copy>
            Tất cả buổi học được gắn với kế hoạch tương ứng. Không có giao dịch
            thực được tạo.
          </Copy>
          <RouteButton href={`/paths/${id}/sessions`}>
            Xem các buổi học
          </RouteButton>
        </Panel>
      ) : (
        <>
          <Panel title="Trước khi bắt đầu">
            <Copy>
              {path.type === "TWO_WAY"
                ? `Hai bên cùng tạm giữ ${path.credit} CR/người cho toàn thỏa thuận.`
                : `Chỉ người học tạm giữ ${path.credit} CR; người dạy tạm giữ 0 CR.`}
            </Copy>
            <Copy muted>
              Số dư kiểm tra của hai tài khoản mẫu: 180 CR/người. Đây là kịch
              bản xem thử, không phải ví tài khoản của bạn.
            </Copy>
            <Copy>
              Kiểm tra đủ kế hoạch, các phiên bản xác nhận, thời lượng, trùng
              lịch và số dư trước khi khóa tất cả lịch cùng lúc.
            </Copy>
            <Button
              variant="paper"
              onPress={() => {
                setError(
                  finalValidation(
                    path,
                    { me: 180, partner: 180 },
                    Date.now(),
                    occupied,
                  ),
                );
                setChecked(true);
              }}
            >
              Kiểm tra điều kiện mẫu
            </Button>
            {checked && (
              <FormNotice tone={error ? "error" : "success"}>
                {error ?? "Đủ điều kiện trong kịch bản mẫu."}
              </FormNotice>
            )}
            <Button
              disabled={!checked || !!error}
              variant="craft"
              onPress={() => {
                const nextError = finalValidation(
                  path,
                  {
                    me: 180,
                    partner: 180,
                  },
                  Date.now(),
                  occupied,
                );
                if (nextError) {
                  setError(nextError);
                  return;
                }
                save({ ...path, status: "ACTIVE" });
              }}
            >
              Xác nhận khóa lịch mẫu
            </Button>
          </Panel>
          <RouteButton secondary href={`/paths/${id}/schedules`}>
            Quay lại kiểm tra lịch
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
