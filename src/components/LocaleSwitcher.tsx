"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === locale}
          onClick={() => router.replace(pathname, { locale: l })}
          className="min-h-11 min-w-11 rounded-md px-2 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-foreground aria-pressed:bg-surface aria-pressed:text-foreground"
        >
          {l}
        </button>
      ))}
    </div>
  );
}
