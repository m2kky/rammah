import BookingFlow from "@/components/BookingFlow";

export default async function BookingOfferingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <BookingFlow slug={decodeURIComponent(slug)} />;
}
