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
import { PathOverviewPanel, type PathOverview } from "./path-overview";
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
  const overview = useUserResource<PathOverview>(
    "learning-paths/" + id + "/overview",
  );
  const { ready, ownConfirmed, editable, canAdd } = pathPermissions(
    path,
    actor.userId,
  );
  const activeTab =
    path?.lockedVersion != null && tab === "finalize" ? "schedule" : tab;
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
            title="Lộ trình học"
            action={
              <div className="learner-actions">
                <Status value={path.status} />
                <Link
                  className="btn"
                  href={"/learn/messages/" + path.conversationId}
                >
                  Nhắn tin
                </Link>
              </div>
            }
          />
          <PathOverviewPanel pathId={id} />
          <details>
            <summary>Thỏa thuận học tập</summary>
            <PathAgreementSummary path={path} />
          </details>
          <CommandFeedback command={command} />
          <div className="path-tabs" aria-label="Các phần của lộ trình">
            {[
              ["overview", "Thỏa thuận"],
              [
                "plans",
                path.agreement.exchangeType === "TWO_WAY"
                  ? "Hai kế hoạch"
                  : "Kế hoạch học",
              ],
              ["schedule", "Lịch học"],
              ...(path.lockedVersion === null
                ? [["finalize", "Chốt lịch"]]
                : []),
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={activeTab === value ? "active" : ""}
                aria-pressed={activeTab === value}
                onClick={() => setTab(value!)}
              >
                {label}
              </button>
            ))}
          </div>
          {!!path.lockedVersion && (
            <div hidden={activeTab !== "overview"}>
              <div className="learner-stack">
                <SettlementStatusPanel key={path.id} pathId={path.id} />
                <LearningChangePanel
                  pathId={path.id}
                  canRequest={
                    !path.settledAt &&
                    !!overview.data &&
                    !["LEARNING_FINISHED", "COMPLETED", "STOPPED"].includes(
                      overview.data.learningStage ?? "",
                    ) &&
                    ["SCHEDULED", "ACTIVE", "DISPUTED"].includes(path.status)
                  }
                  blocked={query.loading || !!query.error}
                />
                <PathReviews path={path} />
              </div>
            </div>
          )}
          {activeTab === "overview" && editable && (
            <div className="learner-stack">
              <div className="learner-stack">
                {" "}
                <Panel title="Xác nhận thỏa thuận">
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
                        {ownConfirmed ? "Đã xác nhận" : "Xác nhận thỏa thuận"}
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
                      : "Chờ hai bên xác nhận."}
                  </p>
                </Panel>
                {editing && editable && conversation && (
                  <AgreementCreator
                    key={path.currentVersion}
                    path={path}
                    conversation={conversation}
                  />
                )}
              </div>
            </div>
          )}
          {activeTab === "plans" && (
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
                <Panel title="Tạo kế hoạch">
                  <PlanEditor path={path} onSaved={query.reload} />
                </Panel>
              )}
              {!path.plans.length && !canAdd && (
                <Panel title="Kế hoạch học">
                  <p>
                    Chờ người hướng dẫn tạo kế hoạch sau khi hai bên xác nhận.
                  </p>
                </Panel>
              )}
            </div>
          )}
          {activeTab === "schedule" && (
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
          {activeTab === "finalize" && (
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
