import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site/site-header";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSiteContent } from "@/lib/site/content";

type SiteLayoutProps = {
  children: ReactNode;
};

export default async function SiteLayout({ children }: SiteLayoutProps) {
  const locale = await getRequestLocale();
  const { navigation } = getSiteContent(locale);

  return (
    <>
      <div className="site-header-fixed fixed inset-x-0 top-0 z-40">
        <SiteHeader
          avatarLabel={navigation.avatarLabel}
          brandLabel={navigation.brandLabel}
          locale={locale}
          navItems={navigation.items}
        />
      </div>
      {children}
    </>
  );
}
