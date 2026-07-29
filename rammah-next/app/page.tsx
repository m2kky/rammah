import HomeClient from "@/components/HomeClient";
import Footer from "@/components/Footer";
import {
  fetchPublicNavigation,
  fetchPublicPage,
  fetchPublicSiteSettings,
} from "@/lib/api/cms";
import { getPageMetadata, getSiteBrand } from "@/lib/api/cms-content";

export async function generateMetadata() {
  const page = await fetchPublicPage("home").catch(() => null);
  return getPageMetadata(
    page,
    "Ahmed Rammah — Engineer · Systematizer · Trainer · Coach",
    "I map your psychological system, find the bugs, and rewrite the code.",
  );
}

export default async function Home() {
  const [page, navigation, settings] = await Promise.all([
    fetchPublicPage("home").catch(() => null),
    fetchPublicNavigation("header").catch(() => []),
    fetchPublicSiteSettings().catch(() => null),
  ]);

  return (
    <HomeClient
      page={page}
      navigation={navigation}
      siteName={getSiteBrand(settings)}
      footer={<Footer />}
    />
  );
}
