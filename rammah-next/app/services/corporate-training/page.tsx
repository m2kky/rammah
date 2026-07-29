import PublicFrame from "@/components/PublicFrame";
import CorporateExperience from "@/components/corporate/CorporateExperience";

import { fetchPublicPage } from "@/lib/api/cms";
import { getPageMetadata } from "@/lib/api/cms-content";

export async function generateMetadata() {
  const page = await fetchPublicPage("corporate-training").catch(() => null);
  return getPageMetadata(
    page,
    "Corporate Training | Ahmed Rammah",
    "aCRL behavioral frameworks and systems engineering applied to corporate teams and leadership. Change the operating system of your company.",
  );
}

export default async function CorporateTrainingPage() {
  const page = await fetchPublicPage("corporate-training").catch(() => null);

  return (
    <PublicFrame>
      <CorporateExperience page={page} />
    </PublicFrame>
  );
}
