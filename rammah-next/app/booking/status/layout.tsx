import { privateMetadata } from "@/lib/seo/metadata";

export const metadata = privateMetadata("Booking status");

export default function BookingStatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
