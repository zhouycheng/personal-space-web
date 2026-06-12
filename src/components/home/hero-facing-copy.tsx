import type { HeroFacingContent, HeroFacingVariant } from "@/lib/site/content";

type HeroFacingCopyProps = {
  content: HeroFacingContent;
  variant: HeroFacingVariant;
};

export function HeroFacingCopy({ content, variant }: HeroFacingCopyProps) {
  const isReveal = variant === "reveal";

  return (
    <div className={["hero-pointer-copy", isReveal ? "hero-pointer-copy--reveal" : ""].join(" ")}>
      <h1
        className={[
          "hero-pointer-title hero-title-balance font-home-mono leading-[0.98]",
          isReveal ? "hero-pointer-title--reveal" : "hero-pointer-title--primary",
        ].join(" ")}
      >
        <span
          className={[
            "hero-pointer-leading",
            isReveal ? "font-semibold" : "font-bold",
          ].join(" ")}
        >
          {content.leading}
        </span>
        <span
          className={[
            "hero-pointer-accent",
            isReveal ? "hero-pointer-title-accent--reveal" : "hero-pointer-title-accent--primary",
            "font-medium",
          ].join(" ")}
        >
          {content.accent}
        </span>
      </h1>

      <p
        className={[
          "hero-pointer-subtitle mt-6 max-w-[32rem] font-home-mono text-[clamp(0.95rem,4.3vw,1.125rem)] font-normal leading-[1.45] tracking-[-0.035em] md:text-[22px] xl:text-[24px]",
          isReveal ? "hero-pointer-subtitle--reveal" : "hero-pointer-subtitle--primary",
        ].join(" ")}
      >
        {content.subtitle}
      </p>
    </div>
  );
}
