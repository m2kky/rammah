import BookingLanding from "@/components/BookingLanding";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Book a session",
  description: "Choose a service and find an available time with Ahmed Rammah.",
  pathname: "/booking",
});

export default function BookingPage() {
  return <BookingLanding />;
}
