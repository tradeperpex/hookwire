"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mark, Wordmark } from "./Mark";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/pools", label: "Pools" },
  { href: "/keepers", label: "Keepers" },
  { href: "/docs", label: "Docs" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) toggle.current?.focus();
  }, []);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("a,button");
        const all = [toggle.current!, ...Array.from(f)];
        const first = all[0];
        const last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 900) close();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.classList.remove("menu-open");
    };
  }, [open, close]);

  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: scrolled || open ? "rgba(0,0,0,0.6)" : "transparent",
          backdropFilter: scrolled || open ? "saturate(1.4) blur(16px)" : "none",
          WebkitBackdropFilter: scrolled || open ? "saturate(1.4) blur(16px)" : "none",
          borderBottom: `1px solid ${scrolled || open ? "var(--line)" : "transparent"}`,
          transition: "background-color .3s var(--ease), border-color .3s var(--ease)",
        }}
      >
        <div
          className="container"
          style={{
            height: 72,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
          }}
        >
          <Link
            href="/"
            aria-label="Hookwire, home"
            onClick={() => close()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              position: "relative",
              zIndex: 60,
              justifySelf: "start",
              minHeight: 44,
            }}
          >
            <Mark size={32} />
            <Wordmark />
          </Link>

          <nav aria-label="Primary" className="nav-links">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link" aria-current={pathname === l.href ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div style={{ gridColumn: 3, justifySelf: "end", display: "flex", alignItems: "center", gap: 8 }}>
            <a href={SITE.x} target="_blank" rel="noopener noreferrer" className="nav-link nav-x">
              Follow on X
            </a>
            <Link href="/app" className="btn btn-primary nav-cta" style={{ minHeight: 42, padding: "0 20px" }}>
              Open app
            </Link>
            <button
              ref={toggle}
              type="button"
              className="menu-btn"
              aria-expanded={open}
              aria-controls="menu-panel"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              style={{ position: "relative", zIndex: 60 }}
            >
              <span className="menu-bars" data-open={open} aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        id="menu-panel"
        ref={panel}
        className="menu-panel"
        data-open={open}
        aria-hidden={!open}
        role="dialog"
        aria-label="Menu"
      >
        <nav aria-label="Mobile" style={{ display: "grid", gap: 4 }}>
          {LINKS.map((l, i) => (
            <span key={l.href} className="menu-row" style={{ ["--i" as string]: i }}>
              <Link href={l.href} tabIndex={open ? 0 : -1} onClick={() => close()} className="menu-link">
                {l.label}
              </Link>
            </span>
          ))}
        </nav>
        <span className="menu-row" style={{ ["--i" as string]: LINKS.length, marginTop: 28 }}>
          <Link
            href="/app"
            tabIndex={open ? 0 : -1}
            onClick={() => close()}
            className="btn btn-primary"
            style={{ width: "100%", minHeight: 52 }}
          >
            Open app
          </Link>
        </span>
      </div>
    </>
  );
}
