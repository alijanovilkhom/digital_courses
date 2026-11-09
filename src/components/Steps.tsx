import { getTranslations } from "next-intl/server";

const steps = ["choose", "study", "ask"] as const;

export default async function Steps() {
  const t = await getTranslations("Steps");

  return (
    <section className="section ground-surface" id="how">
      <div className="wrap">
        <h2>{t("title")}</h2>
        <ol className="grid gap-8 sm:gap-6 md:grid-cols-3">
          {steps.map((key, i) => (
            <li key={key} className="flex flex-col gap-4 border-t border-border pt-6">
              <span className="font-mono text-[13px] text-muted">
                0{i + 1}
              </span>
              <h3 className="text-xl leading-snug">{t(`${key}.title`)}</h3>
              <p className="text-muted">{t(`${key}.text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
