"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/console/icon";
import styles from "./admin-filter-panel.module.css";

export function AdminFilterTrigger({
  label = "Bộ lọc",
  activeCount = 0,
  open,
  onToggle,
  onClear,
  panelId,
}: Readonly<{
  label?: string;
  activeCount?: number;
  open: boolean;
  onToggle: () => void;
  onClear?: () => void;
  panelId?: string;
}>) {
  return (
    <>
      <button
        type="button"
        className={
          activeCount > 0 || open
            ? `${styles.toggle} ${styles.toggleActive}`
            : styles.toggle
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <Icon name="sliders" size={15} />
        <span>{label}</span>
        {activeCount > 0 && <span className={styles.count}>{activeCount}</span>}
        <Icon
          name="down"
          size={14}
          className={
            open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron
          }
        />
      </button>
      {activeCount > 0 && onClear && (
        <button type="button" className={styles.clearBtn} onClick={onClear}>
          Xóa lọc
        </button>
      )}
    </>
  );
}

export function AdminFilterPanel({
  label = "Bộ lọc",
  activeCount = 0,
  onClear,
  lead,
  actions,
  flush = false,
  hideBar = false,
  panelId: providedPanelId,
  open: controlledOpen,
  onOpenChange,
  children,
}: Readonly<{
  label?: string;
  activeCount?: number;
  onClear?: () => void;
  lead?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  hideBar?: boolean;
  panelId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const generatedPanelId = useId();
  const panelId = providedPanelId ?? generatedPanelId;
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  if (hideBar && !isOpen) return null;

  return (
    <div className={flush ? `${styles.root} ${styles.flush}` : styles.root}>
      {!hideBar && (
        <div className={styles.bar}>
          {lead && <div className={styles.lead}>{lead}</div>}
          <div className={styles.controls}>
            <AdminFilterTrigger
              label={label}
              activeCount={activeCount}
              open={isOpen}
              onToggle={() => setOpen(!isOpen)}
              onClear={onClear}
              panelId={panelId}
            />
            {actions}
          </div>
        </div>
      )}

      {isOpen && (
        <div id={panelId} className={styles.panel}>
          {children}
        </div>
      )}
    </div>
  );
}

export { styles as filterPanelStyles };
