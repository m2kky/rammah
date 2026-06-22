import BookingStatus from "@/components/BookingStatus";

export default async function BookingStatusTokenPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;

  return <BookingStatus publicToken={decodeURIComponent(publicToken)} />;
}
