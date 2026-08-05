import Navbar from "@/components/Navbar";
import { fetchPublicNavigation, fetchPublicSiteSettings } from "@/lib/api/cms";
import { getSiteBrand } from "@/lib/api/cms-content";

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const [navigation, settings] = await Promise.all([
    fetchPublicNavigation("header").catch(() => []),
    fetchPublicSiteSettings().catch(() => null),
  ]);

  return (
    <>
      <Navbar entryReady navigation={navigation} siteName={getSiteBrand(settings)} />
      <div className="pt-12 md:pt-20">{children}</div>
    </>
  );
}
