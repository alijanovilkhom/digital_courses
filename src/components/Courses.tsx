import { getLocale, getTranslations } from "next-intl/server";
import { formatPrice, getCatalog } from "@/lib/catalog";

export default async function Courses() {
  const t = await getTranslations("Courses");
  const locale = (await getLocale()) as "ru" | "uz" | "en";
  const { courses, teachers } = await getCatalog();

  return (
    <section className="section" id="courses">
      <div className="wrap">
        <h2>{t("title")}</h2>
        <p className="section__intro">{t("intro")}</p>
        {courses.length === 0 ? (
          <p className="text-muted">{t("empty")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {courses.map((c) => {
              const teacher = teachers.find((x) => x.id === c.teacherId);
              return (
                <li key={c.id} className="card flex flex-col gap-4">
                  <p className="font-mono text-[13px] text-muted">
                    {c.duration[locale]} · {c.level[locale]}
                  </p>
                  <h3 className="text-xl leading-snug">{c.title[locale]}</h3>
                  <p className="text-muted">{c.description[locale]}</p>
                  <div className="mt-auto flex items-end justify-between gap-4 border-t border-border pt-4">
                    <span className="text-sm text-muted">{teacher?.name}</span>
                    <span className="font-medium tabular-nums">
                      {formatPrice(locale, c.price, c.currency)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
