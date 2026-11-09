import { getLocale, getTranslations } from "next-intl/server";
import { formatPrice, getCatalog } from "@/lib/catalog";

export default async function Pricing() {
  const t = await getTranslations("Pricing");
  const locale = (await getLocale()) as "ru" | "uz" | "en";
  const { courses } = await getCatalog();

  return (
    <section className="section ground-surface" id="pricing">
      <div className="wrap">
        <h2>{t("title")}</h2>
        <p className="section__intro">{t("intro")}</p>
        {courses.length === 0 ? (
          <p className="text-muted">{t("empty")}</p>
        ) : (
          <ul className="max-w-4xl">
            {courses.map((c) => (
              <li
                key={c.id}
                className="group grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 border-b border-border py-4 md:grid-cols-[1fr_160px_auto]"
              >
                <span className="text-lg">{c.title[locale]}</span>
                <span className="order-3 text-sm text-muted md:order-none">
                  {c.duration[locale]}
                </span>
                <span className="text-lg font-medium tabular-nums transition-colors group-hover:text-accent">
                  {formatPrice(locale, c.price, c.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
