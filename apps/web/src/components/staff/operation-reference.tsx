import styles from "./operations.module.css";

export function OperationReference({
  id,
  label = "Mã tham chiếu",
}: Readonly<{ id: string; label?: string }>) {
  return (
    <details className={styles.reference}>
      <summary aria-label={`${label}: ${id}`}>
        {label} · #{id.slice(0, 8)}
      </summary>
      <code>{id}</code>
    </details>
  );
}
