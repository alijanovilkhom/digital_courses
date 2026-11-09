import { use } from "react";
import { setRequestLocale } from "next-intl/server";
import Assistant from "@/components/Assistant";
import Courses from "@/components/Courses";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Nav from "@/components/Nav";
import Pricing from "@/components/Pricing";
import Steps from "@/components/Steps";
import Teachers from "@/components/Teachers";

// Render on every request so edits to knowledge/catalog.xlsx show up immediately
export const dynamic = "force-dynamic";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Courses />
        <Steps />
        <Teachers />
        <Pricing />
        <Faq />
        <Assistant />
      </main>
      <Footer />
    </>
  );
}
