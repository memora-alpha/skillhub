import styles from "./loading-skeleton.module.css";

export type SkeletonVariant =
  "page" | "profile" | "section" | "table" | "inline" | "image";

const rowSlots = Array.from(
  { length: 5 },
  (_, position) => `row-${position + 1}`,
);
const profileSlots = Array.from(
  { length: 4 },
  (_, position) => `profile-field-${position + 1}`,
);

function Lines() {
  return (
    <div className={styles.lines}>
      <span className={styles.line} />
      <span className={styles.shortLine} />
    </div>
  );
}

function Rows({ table = false }: Readonly<{ table?: boolean }>) {
  return (
    <div className={table ? styles.table : styles.rows}>
      {rowSlots.slice(0, table ? 5 : 3).map((slot) => (
        <div className={styles.row} key={slot}>
          <span className={styles.avatar} />
          <Lines />
          {table && <span className={styles.badge} />}
        </div>
      ))}
    </div>
  );
}

export function LoadingSkeleton({
  variant = "section",
  label = "Đang tải nội dung",
}: Readonly<{ variant?: SkeletonVariant; label?: string }>) {
  if (variant === "inline")
    return (
      <output className={styles.inline} aria-label={label}>
        <span className={styles.inlineBar} aria-hidden="true" />
        <span className={styles.srOnly}>{label}</span>
      </output>
    );

  return (
    <div className={styles.skeleton} aria-label={label} aria-busy="true">
      <output className={styles.srOnly}>{label}</output>
      <div aria-hidden="true" className={styles[variant]}>
        <SkeletonContent variant={variant} />
      </div>
    </div>
  );
}

function SkeletonContent({
  variant,
}: Readonly<{ variant: Exclude<SkeletonVariant, "inline"> }>) {
  if (variant === "image") return <span className={styles.imageBlock} />;
  if (variant === "profile") return <ProfileSkeleton />;
  if (variant === "page") return <PageSkeleton />;
  return <Rows table={variant === "table"} />;
}
function ProfileSkeleton() {
  return (
    <>
      <div className={styles.hero}>
        <span className={styles.portrait} />
        <Lines />
        <span className={styles.button} />
      </div>
      <div className={styles.columns}>
        <div className={styles.panel}>
          <span className={styles.title} />
          <div className={styles.fields}>
            {profileSlots.map((slot) => (
              <div className={styles.field} key={slot}>
                <span className={styles.shortLine} />
                <span className={styles.input} />
              </div>
            ))}
          </div>
          <span className={styles.textarea} />
          <span className={styles.button} />
        </div>
        <div className={styles.side}>
          <div className={styles.panel}>
            <span className={styles.title} />
            <Rows />
          </div>
          <div className={styles.panel}>
            <Lines />
            <Lines />
          </div>
        </div>
      </div>
    </>
  );
}
function PageSkeleton() {
  return (
    <>
      <div className={styles.heading}>
        <span className={styles.title} />
        <Lines />
      </div>
      <div className={styles.cards}>
        {[0, 1, 2].map((key) => (
          <div className={styles.panel} key={key}>
            <span className={styles.avatar} />
            <Lines />
          </div>
        ))}
      </div>
      <div className={styles.panel}>
        <span className={styles.title} />
        <Rows table />
      </div>
    </>
  );
}
