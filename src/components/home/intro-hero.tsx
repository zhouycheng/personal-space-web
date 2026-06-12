"use client";

import type { HeroFacingContent, HeroFacingVariant } from "@/lib/site/content";

import { HeroFacingCopy } from "./hero-facing-copy";
import { usePointerFacingEffect } from "./use-pointer-facing-effect";

type IntroHeroProps = {
  content: HeroFacingContent;
  variant: HeroFacingVariant;
  enableMotionSensor?: boolean;
  id?: string;
  className?: string;
};

export function IntroHero({
  content,
  variant,
  enableMotionSensor = false,
  id,
  className,
}: IntroHeroProps) {
  const motionSensorRef = usePointerFacingEffect<HTMLDivElement>({
    enabled: enableMotionSensor,
  });

  return (
    <section
      id={id}
      className={[
        "home-screen-section home-intro-hero relative z-10 flex items-center justify-center px-6 md:px-10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="hero-pointer-stage flex max-w-5xl flex-col items-center text-center">
        <div
          ref={enableMotionSensor ? motionSensorRef : undefined}
          className="hero-pointer-sensor"
        >
          <HeroFacingCopy content={content} variant={variant} />
        </div>
      </div>
    </section>
  );
}
