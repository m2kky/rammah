import PublicFrame from "@/components/PublicFrame";
import AboutExperience from "@/components/about/AboutExperience";

import { fetchPublicPage } from "@/lib/api/cms";
import { getPageMetadata } from "@/lib/api/cms-content";

export async function generateMetadata() {
  const page = await fetchPublicPage("about").catch(() => null);
  return getPageMetadata(
    page,
    "About Ahmed Rammah",
    "Engineer, systematizer, trainer, and coach using aCRL to decode behavior and build practical change.",
  );
}

export default async function AboutPage() {
  const page = await fetchPublicPage("about").catch(() => null);

  return (
    <PublicFrame>
      <AboutExperience page={page} />
    </PublicFrame>
  );
}
