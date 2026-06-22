import PublicFrame from "@/components/PublicFrame";
import AboutExperience from "@/components/about/AboutExperience";

export const metadata = {
  title: "About Ahmed Rammah",
  description:
    "Engineer, systematizer, trainer, and coach using aCRL to decode behavior and build practical change.",
};

export default function AboutPage() {
  return (
    <PublicFrame>
      <AboutExperience />
    </PublicFrame>
  );
}
