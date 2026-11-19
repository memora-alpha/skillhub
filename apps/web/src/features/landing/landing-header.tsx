"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./icon";
import { Logo } from "./logo";

const navigation = [
  ["#ways", "Hình thức học"],
  ["#how", "Quy trình"],
  ["#credit", "Credit 96%/4%"],
  ["#trust", "Uy tín & xác minh"],
  ["#faq", "Hỏi đáp"],
] as const;

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggle.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !header.current?.contains(event.target)
      )
        setMenuOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 861px)");
    const resize = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
      desktop.removeEventListener("change", resize);
    };
  }, [menuOpen]);

  return (
    <header ref={header} className="site-header">
      <div className="container header-inner">
        <Logo />
        <nav
          className={menuOpen ? "main-nav open" : "main-nav"}
          id="landing-navigation"
          aria-label="Điều hướng chính"
        >
          {navigation.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>
              {label}
            </a>
          ))}
          <Link
            className="mobile-only-link"
            href="/login"
            onClick={() => setMenuOpen(false)}
          >
            Đăng nhập
          </Link>
        </nav>
        <div className="header-actions">
          <Link className="login-link" href="/login">
            Đăng nhập
          </Link>
          <Link className="button button-small" href="/register">
            Bắt đầu miễn phí <Icon name="arrow" size={16} />
          </Link>
          <button
            ref={toggle}
            className="menu-button"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-controls="landing-navigation"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
          >
            <Icon name={menuOpen ? "x" : "menu"} />
          </button>
        </div>
      </div>
    </header>
  );
}
