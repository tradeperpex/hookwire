"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export type Option = { id: string; label: string; note?: string };

// Inline listbox. Built from spans so it can live inside the headline.
export function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
  suffix,
}: {
  value: string;
  options: Option[];
  onChange: (id: string) => void;
  ariaLabel: string;
  /** Punctuation that must stay on the same line as the chip. */
  suffix?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [shift, setShift] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLSpanElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const uid = useId();
  const current = options.find((o) => o.id === value) ?? options[0];

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const rect = btn.current.getBoundingClientRect();
    const popW = Math.min(280, window.innerWidth - 32);
    const overflow = rect.left + popW - (window.innerWidth - 16);
    setShift(overflow > 0 ? -overflow : 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function openMenu() {
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
    setOpen(true);
  }

  function pick(i: number) {
    onChange(options[i].id);
    setOpen(false);
    btn.current?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <span ref={wrap} style={{ position: "relative", display: "inline", whiteSpace: "nowrap" }}>
      <button
        ref={btn}
        type="button"
        className="chip"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        aria-label={`${ariaLabel}: ${current.label}. Change`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) openMenu();
          }
        }}
      >
        <span>{current.label}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {suffix}
      {open && (
        <span
          ref={list}
          id={`${uid}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={`${uid}-o${active}`}
          onKeyDown={onListKey}
          className="pop"
          style={{ left: shift }}
        >
          {options.map((o, i) => (
            <span
              key={o.id}
              id={`${uid}-o${i}`}
              role="option"
              aria-selected={o.id === value}
              data-active={i === active}
              className="pop-item"
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              <span>{o.label}</span>
              {o.note && <span className="pop-note">{o.note}</span>}
              {o.id === value && (
                <svg viewBox="0 0 16 16" aria-hidden="true" className="pop-check">
                  <path
                    d="m3.5 8.5 3 3 6-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
