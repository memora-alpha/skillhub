"use client";
import { LoadingButton } from "@/components/loading-button";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import type { LearningPath, Conversation } from "../types";
import {
  Back,
  CommandFeedback,
  Feedback,
  Panel,
  Status,
} from "../components/common";
import { MemberIdentity } from "../components/member-identity";
import { ProductIcon } from "../components/product-icon";
import { ProfileName } from "../components/profile-name";
import { PlanPanel } from "./plan-panel";
import { PlanEditor } from "./plan-editor";
import { AgreementCreator } from "./agreement-creator";
import { SettlementStatusPanel } from "./settlement-status-panel";
import { LearningChangePanel } from "./learning-change-panel";
import { PathAgreementSummary } from "./agreement-summary";
import { FinalizePanel } from "./finalize-panel";
import { PathOverviewPanel, type PathOverview } from "./path-overview";
import layoutStyles from "../components/learning-layout.module.css";
import styles from "./path-detail.module.css";
import { learningStageLabel } from "./path-navigation";
import { PathSetupFlow } from "./path-setup-flow";
import type { PathSetupStep } from "./path-setup-policy";

function pathPermissions(path: LearningPath | undefined, userId: string) {
  if (!path)
    return {
      ready: false,
      ownConfirmed: undefined,
      partnerConfirmed: undefined,
      editable: false,
      canAdd: false,
    };
  const isParticipantA = userId === path.participantAId;
  const ready =
    !!path.agreement.participantAConfirmedAt &&
    !!path.agreement.participantBConfirmedAt;
  const ownConfirmed = isParticipantA
    ? path.agreement.participantAConfirmedAt
    : path.agreement.participantBConfirmedAt;
  const partnerConfirmed = isParticipantA
    ? path.agreement.participantBConfirmedAt
    : path.agreement.participantAConfirmedAt;
  const editable =
    path.lockedVersion === null &&
    ["PROPOSED", "PARTIALLY_CONFIRMED", "CONFIRMED"].includes(path.status);
  const canAdd =
    editable &&
    ready &&
    !path.plans.some((plan) => plan.teacherId === userId) &&
    (path.agreement.exchangeType === "TWO_WAY" ||
      path.agreement.teacherId === userId);
  return { ready, ownConfirmed, partnerConfirmed, editable, canAdd };
}

function partnerRoleDescription(path: LearningPath, userId: string) {
  if (path.agreement.exchangeType === "TWO_WAY")
    return "Đối tác trao đổi kỹ năng 2 chiều";
  if (path.agreement.teacherId === userId) return "Người học trong lộ trình";
  if (path.agreement.learnerId === userId) return "Người hướng dẫn của bạn";
  return "Đối tác trong lộ trình";
}

function heroToneClass(path: LearningPath) {
  if (path.status === "DISPUTED") return ` ${styles.heroTopDisputed}`;
  if (path.lockedVersion !== null) return ` ${styles.heroTopLocked}`;
  return "";
}

export function PathDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<LearningPath>("learning-paths/" + id, {
    retainOnTemporaryError: true,
  });
  const { actor, request } = useUserSession();
  const command = useUserCommand(true);
  const [tab, setTab] = useState<PathSetupStep>("overview");
  const [editing, setEditing] = useState(false);
  const [focusPlan, setFocusPlan] = useState<string>();

  useEffect(() => {
    if (tab !== "schedule" || !focusPlan) return;
    const target = document.getElementById("schedule-plan-" + focusPlan);
    target?.scrollIntoView({ block: "start", behavior: "auto" });
    target?.focus();
  }, [tab, focusPlan]);

  const path = query.data;
  const overview = useUserResource<PathOverview>(
    "learning-paths/" + id + "/overview",
  );
  const { ready, ownConfirmed, partnerConfirmed, editable, canAdd } =
    pathPermissions(path, actor.userId);
  const activeTab =
    path?.lockedVersion != null && tab === "finalize" ? "schedule" : tab;

  const counterpartId = path
    ? path.participantAId === actor.userId
      ? path.participantBId
      : path.participantAId
    : undefined;

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

  const totalBookedSessions =
    path?.plans.reduce((sum, plan) => sum + plan.sessions.length, 0) ?? 0;
  const multiPlanColumn =
    (path?.plans.length ?? 0) > 1 ||
    ((path?.plans.length ?? 0) === 1 && canAdd);

  const navTabs: {
    value: PathSetupStep;
    label: string;
    icon: "shield" | "book" | "calendar" | "check";
    count?: number;
  }[] = path
    ? [
        {
          value: "overview",
          label: path.lockedVersion ? "Tổng quan & kết quả" : "Thỏa thuận",
          icon: "shield",
        },
        {
          value: "plans",
          label:
            path.agreement.exchangeType === "TWO_WAY"
              ? "Hai kế hoạch"
              : "Kế hoạch học",
          icon: "book",
          count: path.plans.length || undefined,
        },
        {
          value: "schedule",
          label: "Lịch học",
          icon: "calendar",
          count: totalBookedSessions || undefined,
        },
        ...(path.lockedVersion === null
          ? [
              {
                value: "finalize" as const,
                label: "Chốt lịch",
                icon: "check" as const,
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className={styles.page}>
      <div>
        <Back href="/learn/paths">Danh sách lộ trình</Back>
      </div>

      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />

      {path && (
        <>
          <header className={styles.hero}>
            <div className={styles.heroTop + heroToneClass(path)}>
              <div className={styles.heroMain}>
                <div className={styles.heroBadges}>
                  <Status
                    value={path.status}
                    label={learningStageLabel(overview.data?.learningStage)}
                  />
                  <span
                    className="exchange-pill"
                    data-type={path.agreement.exchangeType}
                  >
                    <ProductIcon
                      name={
                        path.agreement.exchangeType === "TWO_WAY"
                          ? "users"
                          : "user"
                      }
                      size={13}
                    />
                    {path.agreement.exchangeType === "TWO_WAY"
                      ? "Trao đổi 2 chiều"
                      : "Hướng dẫn 1 chiều"}
                  </span>
                  <span className={styles.lockPill}>
                    <ProductIcon
                      name={path.lockedVersion !== null ? "shield" : "clock"}
                      size={13}
                    />
                    {path.lockedVersion !== null
                      ? `Đã chốt · Phiên bản ${path.lockedVersion}`
                      : `Đang thiết lập · v${path.currentVersion}`}
                  </span>
                </div>

                <h1 className={styles.heroTitle}>
                  {path.plans[0]?.learningGoal || "Lộ trình học 1:1"}
                </h1>

                {counterpartId && (
                  <div className={styles.heroMetaRow}>
                    <MemberIdentity
                      id={counterpartId}
                      description={partnerRoleDescription(path, actor.userId)}
                      small
                    />
                  </div>
                )}
              </div>

              <div className={styles.heroActions}>
                <Link
                  className="btn"
                  href={"/learn/messages/" + path.conversationId}
                >
                  <ProductIcon name="chat" size={16} />
                  Nhắn tin
                </Link>
                {path.lockedVersion !== null && (
                  <Link className="btn btn-primary" href="/learn/calendar">
                    <ProductIcon name="calendar" size={16} />
                    Mở lịch học
                  </Link>
                )}
              </div>
            </div>

            <div className={styles.heroBottom}>
              <PathAgreementSummary path={path} inline />
            </div>
          </header>

          <PathOverviewPanel
            pathId={id}
            onOpenSection={(section) => {
              setTab("overview");
              requestAnimationFrame(() => {
                const target = document.getElementById(section);
                target?.scrollIntoView({ block: "start", behavior: "smooth" });
                target?.focus({ preventScroll: true });
              });
            }}
          />

          <CommandFeedback command={command} />

          <PathSetupFlow
            path={path}
            step={activeTab}
            enabled={editable}
            onStep={setTab}
          >
            {!editable && (
              <nav className={styles.tabNav} aria-label="Các phần của lộ trình">
                {navTabs.map((item) => {
                  const active = activeTab === item.value;
                  return (
                    <button
                      type="button"
                      key={item.value}
                      className={
                        styles.tabBtn +
                        (active ? ` ${styles.tabBtnActive}` : "")
                      }
                      aria-pressed={active}
                      onClick={() => setTab(item.value)}
                    >
                      <ProductIcon name={item.icon} size={16} />
                      <span>{item.label}</span>
                      {item.count !== undefined && (
                        <span className={styles.tabCount}>{item.count}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            {!!path.lockedVersion && (
              <div hidden={activeTab !== "overview"}>
                <div className={layoutStyles.completionHeading}>
                  <p className={layoutStyles.eyebrow}>SAU HỌC TẬP</p>
                  <h2>Kết quả &amp; các bước tiếp theo</h2>
                  <p>
                    Theo dõi quyết toán Credit, gửi đánh giá đối tác và quản lý
                    yêu cầu thay đổi của lộ trình.
                  </p>
                </div>
                <div className={layoutStyles.completionGrid}>
                  <div id="path-settlement" tabIndex={-1}>
                    <SettlementStatusPanel key={path.id} pathId={path.id} />
                  </div>
                  <Panel title="Đánh giá sau lộ trình">
                    <div className={styles.reviewPromptCard}>
                      <p>
                        {path.status === "COMPLETED" && path.settledAt
                          ? "Chia sẻ trải nghiệm học tập về toàn bộ thỏa thuận với đối tác."
                          : "Đánh giá sẽ mở sau khi lộ trình hoàn tất và Credit đã được quyết toán."}
                      </p>
                      <div className={styles.actionRow}>
                        <Link
                          className={
                            path.status === "COMPLETED" && path.settledAt
                              ? "btn btn-primary"
                              : "btn"
                          }
                          href={`/learn/paths/${path.id}/review`}
                        >
                          <ProductIcon name="star" size={16} />
                          {path.status === "COMPLETED" && path.settledAt
                            ? "Viết / xem đánh giá"
                            : "Xem điều kiện đánh giá"}
                        </Link>
                      </div>
                    </div>
                  </Panel>
                  <div id="path-changes" tabIndex={-1}>
                    <LearningChangePanel
                      pathId={path.id}
                      canRequest={
                        !path.settledAt &&
                        !!overview.data &&
                        !["LEARNING_FINISHED", "COMPLETED", "STOPPED"].includes(
                          overview.data.learningStage ?? "",
                        ) &&
                        ["SCHEDULED", "ACTIVE", "DISPUTED"].includes(
                          path.status,
                        )
                      }
                      blocked={query.loading || !!query.error}
                    />
                  </div>
                </div>
              </div>
            )}

            {editable && (
              <div
                className="learner-stack"
                data-setup-pane="overview"
                hidden={activeTab !== "overview"}
              >
                <Panel title="Xác nhận thỏa thuận hai bên">
                  <div className={styles.confirmGrid}>
                    <div
                      className={
                        styles.confirmParticipant +
                        (ownConfirmed
                          ? ` ${styles.confirmParticipantDone}`
                          : "")
                      }
                    >
                      <div className={styles.confirmParticipantLabel}>
                        <small>Phía của bạn</small>
                        <strong>Bạn</strong>
                      </div>
                      <span
                        className={
                          styles.confirmBadge +
                          " " +
                          (ownConfirmed
                            ? styles.confirmBadgeDone
                            : styles.confirmBadgeWait)
                        }
                      >
                        <ProductIcon
                          name={ownConfirmed ? "check" : "clock"}
                          size={13}
                        />
                        {ownConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}
                      </span>
                    </div>

                    <div
                      className={
                        styles.confirmParticipant +
                        (partnerConfirmed
                          ? ` ${styles.confirmParticipantDone}`
                          : "")
                      }
                    >
                      <div className={styles.confirmParticipantLabel}>
                        <small>Phía đối tác</small>
                        <strong>
                          {counterpartId ? (
                            <ProfileName id={counterpartId} />
                          ) : (
                            "Đối tác"
                          )}
                        </strong>
                      </div>
                      <span
                        className={
                          styles.confirmBadge +
                          " " +
                          (partnerConfirmed
                            ? styles.confirmBadgeDone
                            : styles.confirmBadgeWait)
                        }
                      >
                        <ProductIcon
                          name={partnerConfirmed ? "check" : "clock"}
                          size={13}
                        />
                        {partnerConfirmed ? "Đã xác nhận" : "Chờ xác nhận"}
                      </span>
                    </div>
                  </div>

                  <p className={styles.metaNote}>
                    {ready
                      ? "Hai bên đã xác nhận điều khoản. Bạn có thể bấm Tiếp theo để sang bước lập kế hoạch học."
                      : "Cả hai bên cần xác nhận cùng phiên bản điều khoản trước khi tạo kế hoạch học."}
                  </p>

                  <div className="learner-actions">
                    <LoadingButton
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
                              body: {
                                expectedVersion: path.currentVersion,
                              },
                            }),
                        );
                      }}
                      loading={!!command.pending}
                    >
                      <ProductIcon name="check" size={16} />
                      {ownConfirmed ? "Bạn đã xác nhận" : "Xác nhận thỏa thuận"}
                    </LoadingButton>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditing(!editing)}
                    >
                      {editing ? "Đóng chỉnh sửa" : "Điều chỉnh thỏa thuận"}
                    </button>
                  </div>
                </Panel>

                {editing && editable && conversation && (
                  <AgreementCreator
                    key={path.currentVersion}
                    path={path}
                    conversation={conversation}
                    onSaved={() => setEditing(false)}
                  />
                )}
              </div>
            )}

            <div
              className={
                styles.plansGrid +
                (!multiPlanColumn ? ` ${styles.plansGridSingle}` : "")
              }
              data-setup-pane="plans"
              hidden={activeTab !== "plans"}
            >
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
                <Panel title="Tạo kế hoạch giảng dạy của bạn">
                  <PlanEditor path={path} onSaved={query.reload} />
                </Panel>
              )}
              {!path.plans.length && !canAdd && (
                <Panel title="Kế hoạch học">
                  <p className={styles.metaNote}>
                    Chờ người hướng dẫn tạo kế hoạch chi tiết sau khi hai bên
                    hoàn tất xác nhận thỏa thuận.
                  </p>
                </Panel>
              )}
            </div>

            <div
              className="learner-stack"
              data-setup-pane="schedule"
              hidden={activeTab !== "schedule"}
            >
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
                  <p className={styles.metaNote}>
                    Chưa có kế hoạch để xếp lịch học. Vui lòng hoàn tất bước kế
                    hoạch trước.
                  </p>
                </Panel>
              )}
            </div>

            {activeTab === "finalize" && (
              <div data-setup-pane="finalize">
                <FinalizePanel
                  path={path}
                  blocked={query.loading || !!query.error}
                  onEditSchedule={(planId) => {
                    setFocusPlan(planId);
                    setTab("schedule");
                  }}
                />
              </div>
            )}
          </PathSetupFlow>
        </>
      )}
    </div>
  );
}
