import { getTranslations } from "next-intl/server";

const items = ["choose", "source", "languages", "prices"] as const;

export default async function Faq() {
  const t = await getTranslations("Faq");

  return (
    <section className="section" id="faq">
      <div className="wrap grid gap-10 lg:grid-cols-12 lg:gap-6">
        <h2 className="lg:col-span-5">{t("title")}</h2>
        <dl className="!mt-0 lg:col-span-7">
          {items.map((key) => (
            <div key={key} className="border-b border-border py-6 first:pt-0">
              <dt className="text-xl leading-snug">{t(`${key}.q`)}</dt>
              <dd className="mt-3 max-w-[62ch] text-muted">{t(`${key}.a`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
