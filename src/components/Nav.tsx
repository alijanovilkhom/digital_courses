"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import LocaleSwitcher from "./LocaleSwitcher";

const links = ["courses", "teachers", "pricing", "faq", "assistant"] as const;

export default function Nav() {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="nav">
      <div className="wrap flex h-full items-center justify-between gap-6">
        <a
          href="#main"
          className="sr-only rounded-[var(--r-sm)] bg-accent px-4 py-2 font-medium text-[var(--accent-ink)] focus:not-sr-only focus:absolute focus:left-[var(--gut)] focus:top-2"
        >
          {t("skip")}
        </a>
        <a
          href="#top"
          className="flex min-h-11 items-center gap-2 whitespace-nowrap text-lg font-medium sm:text-xl"
        >
          <span
            aria-hidden
            className="size-5 shrink-0 rounded-full border-[5px] border-accent"
          />
          {t("brand")}
        </a>

        <nav
          aria-label={t("label")}
          className="hidden items-center gap-8 text-[15px] font-medium xl:flex"
        >
          {links.map((key) => (
            <a key={key} href={`#${key}`} className="link whitespace-nowrap">
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <LocaleSwitcher />
          </div>
          <a href="#courses" className="btn btn--primary hidden sm:inline-flex">
            {t("cta")}
          </a>
          <button
            type="button"
            className="btn btn--secondary !px-4 xl:hidden"
            aria-expanded={open}
            aria-controls="menu-sheet"
            onClick={() => setOpen((v) => !v)}
          >
            {t("menu")}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="menu-sheet"
          className="sheet fixed inset-x-0 top-[var(--nav)] bottom-0 overflow-auto bg-background"
        >
          <div className="wrap flex flex-col">
            {links.map((key) => (
              <a
                key={key}
                href={`#${key}`}
                onClick={() => setOpen(false)}
                className="flex h-14 items-center border-b border-border text-lg"
              >
                {t(key)}
              </a>
            ))}
            <a
              href="#courses"
              onClick={() => setOpen(false)}
              className="btn btn--primary mt-6 sm:hidden"
            >
              {t("cta")}
            </a>
            <div className="mt-6 sm:hidden">
              <LocaleSwitcher />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
