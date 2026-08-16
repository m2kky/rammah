import LegalDocument from "@/components/LegalDocument";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Terms and Conditions",
  description: "Terms governing Ahmed Rammah services, bookings, and website use.",
  pathname: "/terms",
});

export default function TermsPage() {
  return <LegalDocument slug="terms-and-conditions" />;
}
