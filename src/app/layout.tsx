import type { Metadata, Viewport } from "next";
import "./globals.css";

import { ThemeBootstrapScript } from "@/components/theme/theme-bootstrap-script";
import { ThemeToggleFab } from "@/components/theme/theme-toggle-fab";
import { getHtmlLang } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSiteContent } from "@/lib/site/content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const { metadata } = getSiteContent(locale);

  return {
    title: {
      default: metadata.title,
      template: metadata.titleTemplate,
    },
    description: metadata.description,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const { floatingActions } = getSiteContent(locale);

  return (
    <html lang={getHtmlLang(locale)} className="h-full antialiased" suppressHydrationWarning>
      <body className="site-body min-h-full">
        <ThemeBootstrapScript />
        <div aria-hidden="true" className="site-theme-page-backdrop" />
        <div className="site-app-shell">
          {children}
          <ThemeToggleFab copy={floatingActions} locale={locale} />
        </div>
      </body>
    </html>
  );
}
