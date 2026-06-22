import PublicFrame from "@/components/PublicFrame";
import CorporateExperience from "@/components/corporate/CorporateExperience";

export const metadata = {
  title: "Corporate Training | Ahmed Rammah",
  description:
    "aCRL behavioral frameworks and systems engineering applied to corporate teams and leadership. Change the operating system of your company.",
};

export default function CorporateTrainingPage() {
  return (
    <PublicFrame>
      <CorporateExperience />
    </PublicFrame>
  );
}
