"use client";
import { useState } from "react";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import { Feedback, More, Status, formatTime } from "../components/common";
import { CaseDrawer } from "../components/case-drawer";
import { PrivateCaseThread } from "../account/private-case-thread";
import { reportReasonLabel } from "../account/report-reasons";
import { reportStatusLabel } from "../account/report-status";
import styles from "../components/learning-layout.module.css";

type CaseSummary = {
  id: string;
  status: string;
  reasonCode: string;
  relatedSessionId: string | null;
  blocksSettlement: boolean;
  createdAt: string | null;
};
export function PathCases({
  pathId,
  selected,
  onSelect,
  compact = false,
}: Readonly<{
  pathId: string;
  compact?: boolean;
  selected?: string;
  onSelect: (id: string | undefined) => void;
}>) {
  const cases = useUserList<CaseSummary>(
    `learning-paths/${pathId}/cases?limit=20`,
  );
  const summary = useUserResource<CaseSummary>(
    selected ? `learning-paths/${pathId}/cases/${selected}/summary` : null,
  );
  const current = summary.data?.id === selected ? summary.data : undefined;
  const Container = compact ? "details" : "div";
  const Heading = compact ? "summary" : "h3";
  return (
    <section id="path-cases">
      <Container>
        <Heading>
          Vụ việc trong lộ trình ({cases.items.length}
          {cases.cursor ? "+" : ""})
        </Heading>
        <Feedback
          loading={cases.loading}
          error={cases.error}
          reload={cases.reload}
        />
        <div className={styles.caseList}>
          {cases.items.map((item) => (
            <div className={styles.caseRow} key={item.id}>
              <div>
                <strong>{reportReasonLabel(item.reasonCode)}</strong>
                <Status
                  value={item.status}
                  label={reportStatusLabel(item.status)}
                />
                {item.blocksSettlement && <small>Đang chặn quyết toán</small>}
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => onSelect(item.id)}
              >
                Xem vụ việc →
              </button>
            </div>
          ))}
        </div>
        {!cases.loading && !cases.error && !cases.items.length && (
          <p className="muted">Không có vụ việc trong lộ trình.</p>
        )}
        <More
          cursor={cases.cursor}
          loading={cases.loading}
          onMore={() => {
            void cases.more();
          }}
        />
      </Container>
      {selected && (
        <CaseDrawer
          title={
            current
              ? reportReasonLabel(current.reasonCode)
              : "Vụ việc trong lộ trình"
          }
          onClose={() => onSelect(undefined)}
        >
          <Feedback
            loading={summary.loading}
            error={summary.error}
            reload={summary.reload}
          />
          {current && !summary.error && (
            <>
              <Status
                value={current.status}
                label={reportStatusLabel(current.status)}
              />
              {current.blocksSettlement && (
                <p className="learner-notice">
                  Vụ việc này đang chặn quyết toán Credit.
                </p>
              )}
              {current.createdAt && (
                <p className="muted">Gửi lúc {formatTime(current.createdAt)}</p>
              )}
              <PrivateCaseThread
                caseId={current.id}
                closed={["RESOLVED", "REJECTED"].includes(current.status)}
              />
            </>
          )}
        </CaseDrawer>
      )}
    </section>
  );
}
export function PathCaseList({ pathId }: Readonly<{ pathId: string }>) {
  const [selected, setSelected] = useState<string>();
  return (
    <PathCases
      key={pathId}
      pathId={pathId}
      selected={selected}
      onSelect={setSelected}
    />
  );
}
