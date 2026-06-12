"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Locale } from "@/lib/i18n/config";
import type { SiteNavigationItem } from "@/lib/site/content";

import { ActivityStatusBadge } from "@/components/home/activity-status-badge";

type SiteHeaderProps = {
  brandLabel: string;
  avatarLabel: string;
  locale: Locale;
  navItems: SiteNavigationItem[];
};

const HOME_SECTION_IDS = ["about", "skills", "projects", "articles"] as const;

type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

function isHomeSectionId(value: string): value is HomeSectionId {
  return HOME_SECTION_IDS.includes(value as HomeSectionId);
}

function getSectionIdFromHref(href: string): HomeSectionId | null {
  if (href === "/") {
    return "about";
  }

  const sectionId = href.includes("#")
    ? href.split("#").at(-1)
    : href.replace(/^\/+/, "");

  if (!sectionId || !isHomeSectionId(sectionId)) {
    return null;
  }

  return sectionId;
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ brandLabel, avatarLabel, locale, navItems }: SiteHeaderProps) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<string>("about");
  const [isHomeHeaderElevated, setIsHomeHeaderElevated] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const isHeaderElevated = pathname !== "/" || isHomeHeaderElevated;

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }

    const scrollRoot = document.querySelector<HTMLElement>(".snap-container");
    if (!scrollRoot) {
      return;
    }

    const updateHeaderElevation = () => {
      setIsHomeHeaderElevated(scrollRoot.scrollTop > 24);
    };

    const initialFrame = window.requestAnimationFrame(updateHeaderElevation);
    scrollRoot.addEventListener("scroll", updateHeaderElevation, { passive: true });

    return () => {
      window.cancelAnimationFrame(initialFrame);
      scrollRoot.removeEventListener("scroll", updateHeaderElevation);
    };
  }, [pathname]);

  useEffect(() => {
    // Only run on home page
    if (pathname !== "/") return;

    const sections = navItems
      .map((item) => getSectionIdFromHref(item.href))
      .filter((sectionId): sectionId is HomeSectionId => sectionId !== null);
    const observers = new Map<string, IntersectionObserver>();
    const scrollRoot = document.querySelector<HTMLElement>(".snap-container");
    let hashFrame: number | null = null;

    const hashSectionId = getSectionIdFromHref(window.location.hash);
    if (hashSectionId) {
      hashFrame = window.requestAnimationFrame(() => {
        setActiveSection(hashSectionId);
        document.getElementById(hashSectionId)?.scrollIntoView({ block: "start" });
      });
    }

    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
              setActiveSection(sectionId);
            }
          });
        },
        {
          root: scrollRoot,
          threshold: [0.5],
          rootMargin: "-10% 0px -10% 0px",
        }
      );

      observer.observe(element);
      observers.set(sectionId, observer);
    });

    return () => {
      if (hashFrame !== null) {
        window.cancelAnimationFrame(hashFrame);
      }

      observers.forEach((observer) => observer.disconnect());
    };
  }, [navItems, pathname]);

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }

    const activeButton = navRef.current?.querySelector<HTMLElement>(
      `[data-section-id="${activeSection}"]`
    );

    activeButton?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeSection, pathname]);

  const handleNavClick = (href: string) => {
    const sectionId = getSectionIdFromHref(href);
    if (!sectionId) return;

    if (pathname !== "/") {
      window.location.assign(sectionId === "about" ? "/" : `/#${sectionId}`);
      return;
    }

    const element = document.getElementById(sectionId);

    if (element) {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setActiveSection(sectionId);
      element.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
      window.history.replaceState(null, "", sectionId === "about" ? "/" : `#${sectionId}`);
    }
  };

  return (
    <header
      className="site-header-shell relative z-20 px-6 pb-4 pt-5 md:px-10 md:pb-0 lg:px-12"
      data-elevated={isHeaderElevated ? "true" : "false"}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-x-4 md:gap-y-6">
        <Link
          href="/"
          className="hidden justify-self-start font-home-system text-[22px] font-semibold tracking-[-0.03em] text-[var(--page-heading)] md:col-start-1 md:row-start-1 md:block"
        >
          {brandLabel}
        </Link>

        <div className="site-header-actions relative col-start-2 row-start-1 flex min-w-0 items-start justify-self-end gap-2 md:col-start-3 md:items-center md:gap-3">
          <ActivityStatusBadge locale={locale} />

          <div
            aria-label={avatarLabel}
            className="site-avatar h-10 w-10 rounded-full bg-cover bg-center bg-no-repeat md:h-11 md:w-11"
            style={{ backgroundImage: "url('/avatar/my.jpg')" }}
          />
        </div>

        <nav
          ref={navRef}
          aria-label={locale === "zh" ? "主页章节" : "Home sections"}
          className="site-header-nav col-start-1 row-start-1 flex min-w-0 max-w-full items-center justify-self-start gap-1 overflow-x-auto px-1 py-1 font-home-system text-[13px] text-[var(--page-heading)] md:col-span-1 md:col-start-2 md:row-start-1 md:justify-self-center md:gap-2 md:overflow-visible md:text-[14px]"
        >
          {navItems.map((item) => {
            const isHome = pathname === "/";
            const sectionId = getSectionIdFromHref(item.href);
            const active = isHome && sectionId
              ? activeSection === sectionId
              : isActivePath(pathname, item.href);

            return (
              <button
                key={item.href}
                type="button"
                data-section-id={sectionId ?? undefined}
                onClick={() => handleNavClick(item.href)}
                aria-current={active ? "location" : undefined}
                className={[
                  "site-nav-link min-h-11 shrink-0 rounded-xl px-3 py-3 leading-none md:px-4",
                  active ? "site-nav-link--active font-medium" : "site-nav-link--idle font-normal",
                ].join(" ")}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
