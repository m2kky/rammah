import { privateMetadata } from "@/lib/seo/metadata";

export const metadata = privateMetadata("Booking payment");

export default function BookingPaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
