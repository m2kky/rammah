import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource-variable/dancing-script/wght.css";
import "@fontsource-variable/inter/wght.css";
import "./globals.css";

import FloatingCTA from "@/components/FloatingCTA";
import { fetchPublicGlobalMedia, fetchPublicSiteSettings } from "@/lib/api/cms";
import { getGlobalMedia, getSiteBrand, getSiteLocale } from "@/lib/api/cms-content";
import {
  buildMetadata,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_TITLE,
  siteUrl,
} from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [globals, settings] = await Promise.all([
    fetchPublicGlobalMedia().catch(() => null),
    fetchPublicSiteSettings().catch(() => null),
  ]);
  const defaultOgImage = getGlobalMedia(globals).defaultOgImage;
  const brand = getSiteBrand(settings);
  const base = buildMetadata({
    title: DEFAULT_SITE_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    pathname: "/",
    image: defaultOgImage,
  });

  return {
    ...base,
    metadataBase: siteUrl(),
    title: {
      default: DEFAULT_SITE_TITLE,
      template: "%s | Ahmed Rammah",
    },
    applicationName: brand,
    creator: "Ahmed Rammah",
    publisher: brand,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
      apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await fetchPublicSiteSettings().catch(() => null);

  return (
    <html lang={getSiteLocale(settings)} className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <FloatingCTA />
      </body>
    </html>
  );
}
