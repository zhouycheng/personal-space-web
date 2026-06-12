import { FeaturedProjectsSection } from "@/components/home/featured-projects-section";
import { HomeRevealStage } from "@/components/home/home-reveal-stage";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSiteContent } from "@/lib/site/content";

export default async function Home() {
  const locale = await getRequestLocale();
  const { home } = getSiteContent(locale);

  return (
    <div className="snap-container relative flex flex-col overflow-y-auto overflow-x-hidden bg-[var(--page-background)]">
      <HomeRevealStage hero={home.hero}>
        {/* Section 2: Skills */}
        <section
          id="skills"
          className="home-screen-section relative flex flex-col items-center justify-center"
        >
          <div className="max-w-4xl px-6 text-center">
            <h2 className="font-home-system text-5xl font-bold tracking-tight text-[var(--page-heading)] md:text-6xl">
              {locale === "zh" ? "技能" : "Skills"}
            </h2>
            <p className="mt-6 text-lg text-[var(--page-muted)]">
              {locale === "zh" ? "技能内容即将推出..." : "Skills content coming soon..."}
            </p>
          </div>
        </section>

        {/* Section 3: Projects */}
        <section
          id="projects"
          className="home-screen-section home-projects-section relative flex flex-col items-center justify-start"
        >
          <FeaturedProjectsSection locale={locale} />
        </section>

        {/* Section 4: Articles */}
        <section
          id="articles"
          className="home-screen-section relative flex flex-col items-center justify-center"
        >
          <div className="max-w-4xl px-6 text-center">
            <h2 className="font-home-system text-5xl font-bold tracking-tight text-[var(--page-heading)] md:text-6xl">
              {locale === "zh" ? "文稿" : "Articles"}
            </h2>
            <p className="mt-6 text-lg text-[var(--page-muted)]">
              {locale === "zh" ? "文稿内容即将推出..." : "Articles content coming soon..."}
            </p>
          </div>
        </section>
      </HomeRevealStage>
    </div>
  );
}
