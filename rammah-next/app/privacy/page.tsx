import LegalDocument from "@/components/LegalDocument";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description: "How Ahmed Rammah services collect, use, and protect personal information.",
  pathname: "/privacy",
});

export default function PrivacyPage() {
  return <LegalDocument slug="privacy-policy" />;
}
