"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Keyboard and scroll behavior shared by the learner and console drawers. */
export function useNavigationDrawer(desktopQuery: string) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const restoreFocusAfterClose = useRef(false);
  const close = useCallback((restoreFocus = true) => {
    restoreFocusAfterClose.current = restoreFocus;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const returnTarget = trigger.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length);
    focusable()[0]?.focus();

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (
        !panel.current?.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    const desktop = window.matchMedia(desktopQuery);
    const resize = () => {
      if (desktop.matches) close(false);
    };
    desktop.addEventListener("change", resize);
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", resize);
      document.removeEventListener("keydown", keydown);
      // The main content (including the trigger) is inert until React commits
      // the closed state, so restore focus after that DOM update.
      if (restoreFocusAfterClose.current) {
        returnTarget?.focus();
        restoreFocusAfterClose.current = false;
      }
    };
  }, [open, close, desktopQuery]);

  return { open, show: () => setOpen(true), close, trigger, panel };
}
