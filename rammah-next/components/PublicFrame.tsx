import Navbar from "./Navbar";
import Footer from "./Footer";
import { fetchPublicNavigation, fetchPublicSiteSettings } from "@/lib/api/cms";
import { getSiteBrand } from "@/lib/api/cms-content";

export default async function PublicFrame({ children }: { children: React.ReactNode }) {
  const [headerNavigation, settings] = await Promise.all([
    fetchPublicNavigation("header").catch(() => []),
    fetchPublicSiteSettings().catch(() => null),
  ]);

  return (
    <main className="min-h-[100dvh] overflow-x-clip bg-black text-white">
      <Navbar
        entryReady
        navigation={headerNavigation}
        siteName={getSiteBrand(settings)}
      />
      {children}
      <Footer />
    </main>
  );
}
