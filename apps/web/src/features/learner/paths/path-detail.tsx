"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import type { LearningPath, Conversation } from "../types";
import {
  Back,
  CommandFeedback,
  Feedback,
  PageHeading,
  Panel,
  Status,
} from "../components/common";
import { PlanPanel } from "./plan-panel";
import { PlanEditor } from "./plan-editor";
import { AgreementCreator } from "./agreement-creator";
export function PathDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<LearningPath>("learning-paths/" + id),
    { actor, request } = useUserSession(),
    command = useUserCommand(true),
    router = useRouter();
  const [editing, setEditing] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const path = query.data,
    ready =
      !!path?.agreement.participantAConfirmedAt &&
      !!path?.agreement.participantBConfirmedAt;
  const ownConfirmed =
    path &&
    (actor.userId === path.participantAId
      ? path.agreement.participantAConfirmedAt
      : path.agreement.participantBConfirmedAt);
  const editable =
    !!path &&
    path.lockedVersion === null &&
    ["PROPOSED", "PARTIALLY_CONFIRMED", "CONFIRMED"].includes(path.status);
  const canAdd =
    editable &&
    ready &&
    !path.plans.some((plan) => plan.teacherId === actor.userId) &&
    (path.agreement.exchangeType === "TWO_WAY" ||
      path.agreement.teacherId === actor.userId);
  const conversation: Conversation | undefined = path
    ? {
        id: path.conversationId,
        proposalId: "",
        learningRequestId: null,
        participantAId: path.participantAId,
        participantBId: path.participantBId,
        createdAt: "",
      }
    : undefined;
  return (
    <>
      <Back href="/learn/paths" />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {path && (
        <>
          <PageHeading
            title="Cùng thống nhất hành trình học"
            description={"Phiên bản thỏa thuận " + path.currentVersion}
            action={<Status value={path.status} />}
          />
          <div className="learner-two-columns">
            <div className="learner-stack">
              <Panel title="1. Điều khoản chung">
                <p>
                  {path.agreement.exchangeType === "ONE_WAY"
                    ? "Hướng dẫn một chiều"
                    : "Trao đổi kỹ năng hai chiều"}
                </p>
                <p>
                  <strong>
                    {path.agreement.negotiatedCredit ??
                      path.agreement.totalCreditPerUser}{" "}
                    Credit
                  </strong>
                  {path.agreement.exchangeType === "TWO_WAY"
                    ? " mỗi người tạm giữ"
                    : " cho cả lộ trình"}
                </p>
                <p>
                  {path.agreement.exchangeType === "ONE_WAY"
                    ? path.agreement.teacherId === actor.userId
                      ? "Bạn hướng dẫn, đối tác học."
                      : "Đối tác hướng dẫn, bạn học."
                    : "Mỗi người tự tạo kế hoạch cho chiều mình hướng dẫn."}
                </p>
                {editable && (
                  <div className="learner-actions">
                    <button
                      className="btn btn-primary"
                      disabled={
                        !!ownConfirmed || command.pending || command.uncertain
                      }
                      onClick={() => {
                        void command.run(
                          "terms:" + id + ":" + path.currentVersion,
                          () =>
                            request("learning-paths/" + id + "/confirm", {
                              method: "POST",
                              body: { expectedVersion: path.currentVersion },
                            }),
                        );
                      }}
                    >
                      {ownConfirmed
                        ? "Bạn đã xác nhận điều khoản"
                        : "Tôi xác nhận điều khoản phiên bản này"}
                    </button>
                    <button
                      className="btn"
                      onClick={() => setEditing(!editing)}
                    >
                      {editing ? "Đóng" : "Điều chỉnh thỏa thuận"}
                    </button>
                  </div>
                )}
                <p className="muted">
                  {ready
                    ? "Hai bên đã xác nhận điều khoản."
                    : "Chờ cả hai xác nhận điều khoản trước khi hoàn thiện kế hoạch."}
                </p>
              </Panel>
              {editing && editable && conversation && (
                <AgreementCreator
                  key={path.currentVersion}
                  path={path}
                  conversation={conversation}
                />
              )}
              {path.plans.map((plan) => (
                <PlanPanel
                  key={plan.id + ":" + plan.version}
                  path={path}
                  plan={plan}
                  agreementReady={ready}
                />
              ))}
              {canAdd && (
                <Panel title="2. Tạo kế hoạch bạn hướng dẫn">
                  <PlanEditor path={path} onSaved={query.reload} />
                </Panel>
              )}
              {!path.plans.length && !canAdd && (
                <Panel title="2. Kế hoạch học">
                  <p>
                    Chờ hai bên xác nhận điều khoản và người hướng dẫn tạo kế
                    hoạch.
                  </p>
                </Panel>
              )}
            </div>
            <div className="learner-stack">
              <Panel title="3. Chốt lịch và bắt đầu học">
                {path.lockedVersion ? (
                  <>
                    <p>
                      Lộ trình đã chốt. Lịch chính thức nằm trong từng buổi học
                      bên cạnh.
                    </p>
                    <Link className="btn btn-primary" href="/learn/calendar">
                      Mở lịch học
                    </Link>
                  </>
                ) : (
                  <>
                    <p>
                      Chỉ chốt khi đã có đủ kế hoạch và cả hai cùng xác nhận tất
                      cả lịch.
                    </p>
                    <p>
                      Hệ thống sẽ tạm giữ{" "}
                      {path.agreement.negotiatedCredit ??
                        path.agreement.totalCreditPerUser}{" "}
                      Credit{" "}
                      {path.agreement.exchangeType === "TWO_WAY"
                        ? "từ mỗi người"
                        : "từ người học"}{" "}
                      theo thỏa thuận. Kết quả giữ tiền do BE xác nhận.
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(event) => setReviewed(event.target.checked)}
                      />{" "}
                      Tôi đã kiểm tra nội dung, Credit và giờ học.
                    </label>
                    <button
                      className="btn btn-primary"
                      disabled={
                        !reviewed ||
                        path.status !== "CONFIRMED" ||
                        query.loading ||
                        command.pending ||
                        (command.uncertain && !command.canRetry)
                      }
                      onClick={() => {
                        void command
                          .run(
                            "finalize:" + id + ":" + path.currentVersion,
                            async (key) => {
                              await request(
                                "learning-paths/" + id + "/final-validation",
                                { method: "POST", body: {} },
                              );
                              return request<{ sessions: { id: string }[] }>(
                                "learning-paths/" + id + "/finalize",
                                {
                                  method: "POST",
                                  body: {
                                    expectedVersion: path.currentVersion,
                                  },
                                  key,
                                },
                              );
                            },
                          )
                          .then((result) => {
                            if (result?.data.sessions.length === 1)
                              router.push(
                                "/learn/sessions/" +
                                  result.data.sessions[0]!.id,
                              );
                          });
                      }}
                    >
                      Chốt lịch và tạm giữ Credit
                    </button>
                  </>
                )}
                <CommandFeedback command={command} />
              </Panel>
              <Panel title="Tiếp tục trao đổi">
                <p>
                  Chưa thống nhất? Quay lại trao đổi với đối tác trước khi xác
                  nhận.
                </p>
                <Link
                  className="btn"
                  href={"/learn/messages/" + path.conversationId}
                >
                  Mở cuộc trò chuyện
                </Link>
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}
