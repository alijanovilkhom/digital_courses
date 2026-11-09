import { getLocale, getTranslations } from "next-intl/server";
import { formatPrice, getCatalog } from "@/lib/catalog";

export default async function Hero() {
  const t = await getTranslations("Hero");
  const locale = (await getLocale()) as "ru" | "uz" | "en";
  const { courses, teachers } = await getCatalog();
  // The assistant's example answer shows a real course from the Excel catalog
  const course = courses[0];
  const teacher = teachers.find((x) => x.id === course?.teacherId);

  return (
    <section className="hero" id="top">
      <div className="wrap">
        <h1 className="hero__h1">{t("title")}</h1>
        <p className="hero__lead">{t("lead")}</p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#courses" className="btn btn--primary w-full sm:w-auto">
            {t("primary")}
          </a>
          <a href="#assistant" className="btn btn--secondary w-full sm:w-auto">
            {t("secondary")}
          </a>
        </div>
      </div>

      <div className="wrap hero__frame" aria-hidden>
        <div className="window">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 text-sm text-muted">
            <span className="font-medium text-foreground">
              {t("windowTitle")}
            </span>
          </div>
          <div className="flex flex-col gap-4 p-5 text-base">
            <p
              className="msg max-w-[80%] self-end rounded-[var(--r-sm)] bg-surface px-4 py-3"
              style={{ "--d": "0.3s" } as React.CSSProperties}
            >
              {t("question")}
            </p>
            <p
              className="msg max-w-[80%] py-3 text-muted"
              style={{ "--d": "1.1s" } as React.CSSProperties}
            >
              {t("answer")}
            </p>
            {course && (
              <div
                className="msg flex max-w-[480px] flex-col gap-3 rounded-[var(--r-sm)] bg-surface p-4"
                style={{ "--d": "1.7s" } as React.CSSProperties}
              >
                <p className="font-mono text-[13px] text-muted">
                  {course.duration[locale]} · {course.level[locale]}
                </p>
                <p className="font-medium">{course.title[locale]}</p>
                <div className="flex items-end justify-between gap-4 border-t border-border pt-3 text-sm">
                  <span className="text-muted">{teacher?.name}</span>
                  <span className="font-medium tabular-nums">
                    {formatPrice(locale, course.price, course.currency)}
                  </span>
                </div>
              </div>
            )}
            <div
              className="msg flex items-center justify-between gap-3 rounded-[var(--r-sm)] border border-border bg-surface px-4 py-3 text-muted"
              style={{ "--d": "2.4s" } as React.CSSProperties}
            >
              <span>{t("placeholder")}</span>
              <span className="rounded-[var(--r-sm)] bg-raised px-3 py-1 text-sm font-medium text-foreground">
                {t("send")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
