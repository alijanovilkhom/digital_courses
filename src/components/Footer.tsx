import { getTranslations } from "next-intl/server";

const links = ["courses", "teachers", "pricing", "faq", "assistant"] as const;

export default async function Footer() {
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Nav");

  return (
    <footer className="closing">
      <div className="wrap flex flex-col gap-16">
        <div className="flex flex-col gap-6">
          <h2 className="max-w-[16ch]">{t("title")}</h2>
          <p className="max-w-[52ch] text-lg text-muted">{t("lead")}</p>
          <a href="#courses" className="btn btn--primary w-full self-start sm:w-auto">
            {nav("cta")}
          </a>
        </div>

        <div className="flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            © {new Date().getFullYear()} {nav("brand")}
          </p>
          <nav aria-label={nav("label")}>
            <ul className="flex flex-wrap gap-x-6">
              {links.map((key) => (
                <li key={key}>
                  <a href={`#${key}`} className="flex min-h-11 min-w-11 items-center justify-center text-sm">
                    <span className="link">{nav(key)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
