"use client";
import { useState } from "react";
import Link from "next/link";
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
import { SettlementStatusPanel } from "./settlement-status-panel";
import { LearningChangePanel } from "./learning-change-panel";
import { PathReviews } from "./path-reviews";
import { PathAgreementSummary } from "./agreement-summary";
import { FinalizePanel } from "./finalize-panel";
function pathPermissions(path: LearningPath | undefined, userId: string) {
  if (!path)
    return {
      ready: false,
      ownConfirmed: undefined,
      editable: false,
      canAdd: false,
    };
  const ready =
    !!path.agreement.participantAConfirmedAt &&
    !!path.agreement.participantBConfirmedAt;
  const ownConfirmed =
    userId === path.participantAId
      ? path.agreement.participantAConfirmedAt
      : path.agreement.participantBConfirmedAt;
  const editable =
    path.lockedVersion === null &&
    ["PROPOSED", "PARTIALLY_CONFIRMED", "CONFIRMED"].includes(path.status);
  const canAdd =
    editable &&
    ready &&
    !path.plans.some((plan) => plan.teacherId === userId) &&
    (path.agreement.exchangeType === "TWO_WAY" ||
      path.agreement.teacherId === userId);
  return { ready, ownConfirmed, editable, canAdd };
}
export function PathDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<LearningPath>("learning-paths/" + id, {
      retainOnTemporaryError: true,
    }),
    { actor, request } = useUserSession(),
    command = useUserCommand(true);
  const [tab, setTab] = useState("plans");
  const [editing, setEditing] = useState(false);
  const path = query.data;
  const { ready, ownConfirmed, editable, canAdd } = pathPermissions(
    path,
    actor.userId,
  );
  const oneWayRole =
    path?.agreement.teacherId === actor.userId
      ? "Bạn hướng dẫn, đối tác học."
      : "Đối tác hướng dẫn, bạn học.";
  const roleDescription =
    path?.agreement.exchangeType === "ONE_WAY"
      ? oneWayRole
      : "Mỗi người tự tạo kế hoạch cho chiều mình hướng dẫn.";
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
          <PathAgreementSummary path={path} />
          <CommandFeedback command={command} />
          <div className="path-tabs" aria-label="Các phần của lộ trình">
            {[
              ["overview", "Tổng quan"],
              [
                "plans",
                path.agreement.exchangeType === "TWO_WAY"
                  ? "Hai kế hoạch"
                  : "Kế hoạch học",
              ],
              ["schedule", "Lịch học"],
              ["finalize", "Kiểm tra cuối"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={tab === value ? "active" : ""}
                aria-pressed={tab === value}
                onClick={() => setTab(value!)}
              >
                {label}
              </button>
            ))}
          </div>
          {!!path.lockedVersion && (
            <>
              <SettlementStatusPanel key={path.id} pathId={path.id} />
              <LearningChangePanel
                pathId={path.id}
                canRequest={
                  !path.settledAt &&
                  ["SCHEDULED", "ACTIVE", "DISPUTED"].includes(path.status)
                }
                blocked={query.loading || !!query.error}
              />
              <PathReviews path={path} />
            </>
          )}
          {tab === "overview" && (
            <div className="learner-two-columns">
              <div className="learner-stack">
                {" "}
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
                  <p>{roleDescription}</p>
                  {editable && (
                    <div className="learner-actions">
                      <button
                        type="button"
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
                        type="button"
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
              </div>{" "}
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
          )}
          {tab === "plans" && (
            <div className="plans-grid product-plans">
              {" "}
              {path.plans.map((plan) => (
                <PlanPanel
                  key={plan.id + ":" + plan.version}
                  path={path}
                  plan={plan}
                  agreementReady={ready}
                  mode="plan"
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
          )}
          {tab === "schedule" && (
            <div className="learner-stack">
              {path.plans.map((plan) => (
                <PlanPanel
                  key={plan.id + ":" + plan.version}
                  path={path}
                  plan={plan}
                  agreementReady={ready}
                  mode="schedule"
                />
              ))}
              {!path.plans.length && (
                <Panel title="Lịch học">
                  <p>Chưa có kế hoạch để xếp lịch học.</p>
                </Panel>
              )}
            </div>
          )}
          {tab === "finalize" && (
            <FinalizePanel
              path={path}
              blocked={query.loading || !!query.error}
            />
          )}
        </>
      )}
    </>
  );
}
