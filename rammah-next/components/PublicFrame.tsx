import Navbar from "./Navbar";
import Footer from "./Footer";
import { fetchPublicGlobalMedia, fetchPublicNavigation, fetchPublicSiteSettings } from "@/lib/api/cms";
import { getGlobalMedia, getSiteBrand } from "@/lib/api/cms-content";

export default async function PublicFrame({ children }: { children: React.ReactNode }) {
  const [headerNavigation, settings, globals] = await Promise.all([
    fetchPublicNavigation("header").catch(() => []),
    fetchPublicSiteSettings().catch(() => null),
    fetchPublicGlobalMedia().catch(() => null),
  ]);
  const media = getGlobalMedia(globals);

  return (
    <main className="min-h-[100dvh] overflow-x-clip bg-black text-white">
      <Navbar
        entryReady
        navigation={headerNavigation}
        siteName={getSiteBrand(settings)}
        desktopMenuVideo={media.desktopMenuVideo}
        mobileMenuVideo={media.mobileMenuVideo}
      />
      {children}
      <Footer />
    </main>
  );
}
