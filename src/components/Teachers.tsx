import { getLocale, getTranslations } from "next-intl/server";
import { getCatalog } from "@/lib/catalog";

export default async function Teachers() {
  const t = await getTranslations("Teachers");
  const locale = (await getLocale()) as "ru" | "uz" | "en";
  const { teachers } = await getCatalog();

  return (
    <section className="section" id="teachers">
      <div className="wrap">
        <h2>{t("title")}</h2>
        <p className="section__intro">{t("intro")}</p>
        {teachers.length === 0 ? (
          <p className="text-muted">{t("empty")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {teachers.map((p) => (
              <li key={p.id} className="card flex flex-col gap-4">
                <span
                  aria-hidden
                  className="flex size-14 items-center justify-center rounded-full bg-background font-mono text-lg text-muted"
                >
                  {p.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </span>
                <div>
                  <h3 className="text-xl leading-snug">{p.name}</h3>
                  <p className="text-sm text-muted">{p.role[locale]}</p>
                </div>
                <p className="text-muted">{p.bio[locale]}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
