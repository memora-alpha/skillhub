"use client";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { useState } from "react";
import { useUserResource } from "../hooks/use-user-resource";
import { Feedback, Status, formatTime } from "../components/common";
import { CaseDrawer } from "../components/case-drawer";
import { ProductIcon } from "../components/product-icon";
import { PrivateCaseThread } from "../account/private-case-thread";
import type { CaseCapabilities } from "../account/case-capabilities";
import { reportReasonLabel } from "../account/report-reasons";
import { reportStatusLabel } from "../account/report-status";
import layoutStyles from "../components/learning-layout.module.css";
import styles from "./path-detail.module.css";

type CaseSummary = CaseCapabilities & {
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
  const cases = useUserPagedList<CaseSummary>(
    `learning-paths/${pathId}/cases?limit=20`,
  );
  const summary = useUserResource<CaseSummary>(
    selected ? `learning-paths/${pathId}/cases/${selected}/summary` : null,
  );
  const current = summary.data?.id === selected ? summary.data : undefined;
  const Container = compact ? "details" : "div";
  const Heading = compact ? "summary" : "h3";
  const countLabel = `${cases.items.length}${cases.cursor ? "+" : ""}`;

  return (
    <section id="path-cases">
      <Container>
        <Heading>
          <span>Vụ việc trong lộ trình ({countLabel})</span>
          {compact && <ProductIcon name="chevron" size={15} />}
        </Heading>
        <Feedback
          loading={cases.initialLoading}
          error={cases.error}
          reload={cases.reload}
          refreshing={!!(cases.loading && !cases.initialLoading)}
        />
        <div className={layoutStyles.caseList}>
          {cases.items.map((item) => (
            <div className={layoutStyles.caseRow} key={item.id}>
              <div>
                <strong>{reportReasonLabel(item.reasonCode)}</strong>
                <Status
                  value={item.status}
                  label={reportStatusLabel(item.status)}
                />
                {item.blocksSettlement && (
                  <span className={styles.blockingPill}>
                    Đang chặn quyết toán
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onSelect(item.id)}
              >
                Xem vụ việc
                <ProductIcon name="arrow" size={14} />
              </button>
            </div>
          ))}
        </div>
        {!cases.loading && !cases.error && !cases.items.length && (
          <p className={styles.metaNote} style={{ marginTop: 8 }}>
            Không có vụ việc nào trong lộ trình này.
          </p>
        )}
        <ListPagination query={cases} />
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
            loading={summary.initialLoading}
            error={summary.error}
            reload={summary.reload}
            refreshing={!!(summary.loading && !summary.initialLoading)}
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
                capabilities={current}
                onRefresh={summary.reload}
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
