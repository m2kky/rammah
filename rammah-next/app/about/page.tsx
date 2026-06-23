import PublicFrame from "@/components/PublicFrame";
import AboutExperience from "@/components/about/AboutExperience";

import { fetchPublicPage } from "@/lib/api/cms";

export const metadata = {
  title: "About Ahmed Rammah",
  description:
    "Engineer, systematizer, trainer, and coach using aCRL to decode behavior and build practical change.",
};

export default async function AboutPage() {
  const page = await fetchPublicPage("about").catch(() => null);

  return (
    <PublicFrame>
      <AboutExperience page={page} />
    </PublicFrame>
  );
}
