import { useState } from "react";
import { uuid } from "@/lib/http/contracts";
import { LearningNegotiationScreen } from "./learning-negotiation-screen";
import { ApiPathDetailScreen } from "./ApiPathDetailScreen";
import { learningRoutes } from "@/constants/navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { ChoiceGroup } from "@/components/choice-group";
import { DataForm, creditRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
  Metric,
  ui,
} from "@/components/feature-page";
import { usePathsPreview } from "../context";
import { plansConfirmed, agreementConfirmed } from "../rules";
export function AgreementTypeScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    conversationId?: string;
    proposalId?: string;
  }>();
  const id = params.conversationId ?? params.proposalId;
  if (params.mode === "api" || uuid.safeParse(id).success)
    return <LearningNegotiationScreen conversationId={id ?? ""} />;
  return <PreviewAgreementTypeScreen />;
}
function PreviewAgreementTypeScreen() {
  const { proposalId } = useLocalSearchParams<{ proposalId?: string }>();
  const { save } = usePathsPreview();
  const router = useRouter();
  const [type, setType] = useState("TWO_WAY");
  const [teacher, setTeacher] = useState("Tôi dạy");
  return (
    <FeaturePage title="Chọn hình thức học" back="/messages">
      <Panel title="Cùng nhau thống nhất">
        <ChoiceGroup
          label="Hình thức"
          value={type}
          options={["TWO_WAY", "ONE_WAY"]}
          onChange={setType}
        />
        <Copy>
          {type === "TWO_WAY"
            ? "Mỗi người tạo kế hoạch cho kỹ năng mình dạy. Hai kế hoạch có lịch và xác nhận riêng."
            : "Một người dạy, một người học. Chỉ người học tạm giữ Credit."}
        </Copy>
        {type === "ONE_WAY" && (
          <ChoiceGroup
            label="Vai trò đề xuất của tôi"
            value={teacher}
            options={["Tôi dạy", "Tôi học"]}
            onChange={setTeacher}
          />
        )}
        <DataForm
          key={type}
          defaults={{ credit: type === "TWO_WAY" ? "40" : "100" }}
          fields={[
            {
              name: "credit",
              label:
                type === "TWO_WAY"
                  ? "Cam kết mỗi người / toàn thỏa thuận"
                  : "Giá dạy toàn Learning Path (Credit)",
              rule: creditRule(type === "TWO_WAY" ? 20 : 0, type === "TWO_WAY"),
              numeric: true,
            },
          ]}
          submitLabel="Tạo thỏa thuận mẫu"
          onSubmit={(v) => {
            const id = `path-${Date.now()}`;
            save({
              id,
              title: "Thỏa thuận học mới",
              partner: "Người trao đổi",
              conversationId: proposalId,
              type: type as "TWO_WAY" | "ONE_WAY",
              teacher:
                type === "ONE_WAY"
                  ? teacher === "Tôi dạy"
                    ? "me"
                    : "partner"
                  : undefined,
              credit: v.credit!,
              version: 1,
              status: "PROPOSED",
              plans: [],
              completedSessions: 0,
            });
            router.replace(`/paths/${id}`);
          }}
        />
      </Panel>
      <Copy muted>
        Đây là đề xuất ban đầu. Không tự tạo kế hoạch của người trao đổi, không
        khóa lịch và không tạm giữ Credit.
      </Copy>
    </FeaturePage>
  );
}
export function PathDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return uuid.safeParse(id).success ? (
    <ApiPathDetailScreen />
  ) : (
    <PreviewPathDetailScreen />
  );
}
function PreviewPathDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { paths, save } = usePathsPreview();
  const path = paths.find((p) => p.id === id);
  return (
    <FeaturePage title="Không gian Learning Path" back={learningRoutes.paths}>
      {!path ? (
        <EmptyState
          title="Không tìm thấy Learning Path"
          description="Learning Path không có trong bản xem thử."
        />
      ) : (
        <>
          <Panel title={path.title} accent>
            <Badge label={path.status} />
            <Copy>
              {path.partner} · {path.type} · v{path.version}
            </Copy>
            <View style={ui.row}>
              <Metric
                label={
                  path.type === "TWO_WAY"
                    ? "Cam kết mỗi người"
                    : "Giá toàn Learning Path"
                }
                value={`${path.credit} CR`}
              />
              <Metric
                label="Tiến độ buổi học"
                value={`${path.completedSessions}/${path.plans.reduce((n, p) => n + p.outline.length, 0)}`}
              />
            </View>
          </Panel>
          {path.plans.map((plan) => (
            <Panel key={plan.id} title={plan.skill}>
              <Copy>
                {plan.teacher === "me"
                  ? "Bạn dạy → người trao đổi học"
                  : "Người trao đổi dạy → bạn học"}{" "}
                · v{plan.version}
              </Copy>
              <Copy>{plan.goal}</Copy>
              <Badge
                label={
                  plan.learnerVersion === plan.version
                    ? "Người học đã xác nhận"
                    : "Chờ người học xác nhận"
                }
              />
              <RouteButton secondary href={`/paths/${id}/plans/${plan.id}`}>
                Xem kế hoạch
              </RouteButton>
            </Panel>
          ))}
          {path.status === "PROPOSED" &&
            !path.plans.some((p) => p.teacher === "me") &&
            (path.type === "TWO_WAY" || path.teacher === "me") && (
              <RouteButton href={`/paths/${id}/plans/new`}>
                Tạo kế hoạch tôi dạy
              </RouteButton>
            )}
          {path.plans.length < (path.type === "TWO_WAY" ? 2 : 1) && (
            <FormNotice tone="info">
              Chờ người trao đổi tự tạo kế hoạch cho chiều họ dạy.
            </FormNotice>
          )}
          <Panel title="Xác nhận điều khoản chung">
            <Copy>
              Bạn:{" "}
              {path.meVersion === path.version
                ? "Đã xác nhận"
                : "Chưa xác nhận"}{" "}
              · Người trao đổi:{" "}
              {path.partnerVersion === path.version
                ? "Đã xác nhận"
                : "Chưa xác nhận"}
            </Copy>
            <Copy muted>
              Xác nhận thỏa thuận không thay thế xác nhận riêng của từng kế
              hoạch.
            </Copy>
            {path.status === "PROPOSED" && (
              <Button
                disabled={
                  !plansConfirmed(path) || path.meVersion === path.version
                }
                variant="craft"
                onPress={() => save({ ...path, meVersion: path.version })}
              >
                Xác nhận điều khoản v{path.version}
              </Button>
            )}
          </Panel>
          {path.status === "PROPOSED" && (
            <RouteButton secondary href={`/paths/${id}/schedules`}>
              {agreementConfirmed(path)
                ? "Lịch của từng kế hoạch"
                : "Xem điều kiện tạo lịch"}
            </RouteButton>
          )}
          {path.status === "PROPOSED" && (
            <RouteButton secondary href={`/paths/${id}/hold`}>
              Kiểm tra và tạm giữ Credit
            </RouteButton>
          )}
          {path.status === "PROPOSED" && (
            <RouteButton secondary href={`/paths/${id}/terms`}>
              Điều chỉnh điều khoản / hình thức
            </RouteButton>
          )}
          {path.status === "ACTIVE" && (
            <RouteButton href={`/paths/${id}/sessions`}>
              Các buổi học
            </RouteButton>
          )}
          {path.status === "COMPLETED" && (
            <>
              <RouteButton href={`/paths/${id}/settlement`}>
                Kết quả quyết toán
              </RouteButton>
              <RouteButton secondary href={`/paths/${id}/review`}>
                Đánh giá cuối Learning Path
              </RouteButton>
            </>
          )}
          {path.status === "DISPUTED" && (
            <FormNotice tone="info">
              Learning Path đang có tranh chấp. Quyết toán cuối đang được giữ để
              xem xét.
            </FormNotice>
          )}
          {["PROPOSED", "ACTIVE", "CANCELLED"].includes(path.status) && (
            <RouteButton secondary href={`/paths/${id}/cancel`}>
              Hủy / dừng Learning Path
            </RouteButton>
          )}
          <RouteButton
            secondary
            href={
              path.conversationId ? `/chat/${path.conversationId}` : "/messages"
            }
          >
            Trao đổi qua tin nhắn
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
