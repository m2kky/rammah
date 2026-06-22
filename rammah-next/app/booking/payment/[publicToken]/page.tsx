import BookingPaymentFrame from "@/components/BookingPaymentFrame";

type BookingPaymentPageProps = {
  params: Promise<{
    publicToken: string;
  }>;
};

export default async function BookingPaymentPage({ params }: BookingPaymentPageProps) {
  const { publicToken } = await params;
  return <BookingPaymentFrame publicToken={decodeURIComponent(publicToken)} />;
}
