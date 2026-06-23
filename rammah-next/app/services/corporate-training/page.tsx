import PublicFrame from "@/components/PublicFrame";
import CorporateExperience from "@/components/corporate/CorporateExperience";

import { fetchPublicPage } from "@/lib/api/cms";

export const metadata = {
  title: "Corporate Training | Ahmed Rammah",
  description:
    "aCRL behavioral frameworks and systems engineering applied to corporate teams and leadership. Change the operating system of your company.",
};

export default async function CorporateTrainingPage() {
  const page = await fetchPublicPage("corporate-training").catch(() => null);

  return (
    <PublicFrame>
      <CorporateExperience page={page} />
    </PublicFrame>
  );
}
