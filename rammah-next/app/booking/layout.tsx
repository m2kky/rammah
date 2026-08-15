import Navbar from "@/components/Navbar";
import { fetchPublicGlobalMedia, fetchPublicNavigation, fetchPublicSiteSettings } from "@/lib/api/cms";
import { getGlobalMedia, getSiteBrand } from "@/lib/api/cms-content";

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const [navigation, settings, globals] = await Promise.all([
    fetchPublicNavigation("header").catch(() => []),
    fetchPublicSiteSettings().catch(() => null),
    fetchPublicGlobalMedia().catch(() => null),
  ]);
  const media = getGlobalMedia(globals);

  return (
    <>
      <Navbar entryReady navigation={navigation} siteName={getSiteBrand(settings)} desktopMenuVideo={media.desktopMenuVideo} mobileMenuVideo={media.mobileMenuVideo} />
      <div className="pt-12 md:pt-20">{children}</div>
    </>
  );
}
