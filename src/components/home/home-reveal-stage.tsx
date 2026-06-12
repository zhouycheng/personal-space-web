import type { ReactNode } from "react";
import type { HeroFacingContent, HeroFacingVariant } from "@/lib/site/content";

import { CustomCursor } from "./custom-cursor";
import { DotGridBackground } from "./dot-grid-background";
import { IntroHero } from "./intro-hero";

type HomeRevealStageProps = {
  hero: Record<HeroFacingVariant, HeroFacingContent>;
  children: ReactNode;
};

export function HomeRevealStage({ hero, children }: HomeRevealStageProps) {
  return (
    <CustomCursor activeTargetSelector="#about" scrollRootSelector=".snap-container">
      <div aria-hidden="true" className="home-scene-layer home-scene-layer--base">
        <DotGridBackground variant="primary" />
      </div>

      <div aria-hidden="true" className="home-reveal-mask-layer">
        <div className="home-reveal-mask-backdrop">
          <DotGridBackground variant="reveal" />
        </div>
        <div className="home-hero-reveal-layer">
          <IntroHero content={hero.reveal} variant="reveal" />
        </div>
      </div>

      <div className="home-scene-layer home-scene-layer--content">
        <IntroHero
          id="about"
          content={hero.primary}
          variant="primary"
          enableMotionSensor
        />
        {children}
      </div>
    </CustomCursor>
  );
}
