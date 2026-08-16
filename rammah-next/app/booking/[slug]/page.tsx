import type { Metadata } from "next";
import BookingFlow from "@/components/BookingFlow";
import { fetchPublicGlobalMedia } from "@/lib/api/cms";
import { getGlobalMedia } from "@/lib/api/cms-content";
import { fetchPublicOffering } from "@/lib/api/offerings";
import { offeringMetadata } from "@/lib/seo/content-metadata";
import { buildMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const [offering, globals] = await Promise.all([
    fetchPublicOffering(decodedSlug).catch(() => null),
    fetchPublicGlobalMedia().catch(() => null),
  ]);
  return offering
    ? offeringMetadata(
        offering,
        `/booking/${offering.slug}`,
        getGlobalMedia(globals).defaultOgImage,
      )
    : buildMetadata({
        title: "Booking unavailable",
        description: "This booking option is not currently available.",
        pathname: `/booking/${decodedSlug}`,
        noindex: true,
      });
}

export default async function BookingOfferingPage({
  params,
}: Props) {
  const { slug } = await params;

  return <BookingFlow slug={decodeURIComponent(slug)} />;
}
