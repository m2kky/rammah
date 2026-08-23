import PublicFrame from "@/components/PublicFrame";
import AboutExperience from "@/components/about/AboutExperience";

import { fetchPublicGlobalMedia, fetchPublicPage } from "@/lib/api/cms";
import { getAboutMedia, getGlobalMedia, getPageMetadata } from "@/lib/api/cms-content";

export async function generateMetadata() {
  const [page, globals] = await Promise.all([
    fetchPublicPage("about").catch(() => null),
    fetchPublicGlobalMedia().catch(() => null),
  ]);
  return getPageMetadata(
    page,
    "About Ahmed Rammah",
    "Engineer, systematizer, trainer, and coach using aCRL to decode behavior and build practical change.",
    "/about",
    getGlobalMedia(globals).defaultOgImage,
  );
}

export default async function AboutPage() {
  const [page, globals] = await Promise.all([
    fetchPublicPage("about").catch(() => null),
    fetchPublicGlobalMedia().catch(() => null),
  ]);

  return (
    <PublicFrame>
      <AboutExperience page={page} media={getAboutMedia(globals, page)} />
    </PublicFrame>
  );
}
