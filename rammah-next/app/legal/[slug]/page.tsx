import type { Metadata } from "next";
import LegalDocument from "../../../components/LegalDocument";
import { fetchPublicGlobalMedia, fetchPublicLegalPage } from "../../../lib/api/cms";
import { getGlobalMedia } from "../../../lib/api/cms-content";
import { buildMetadata } from "../../../lib/seo/metadata";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const [page, globals] = await Promise.all([
    fetchPublicLegalPage(decodedSlug).catch(() => null),
    fetchPublicGlobalMedia().catch(() => null),
  ]);
  return page ? buildMetadata({
    title: page.seo?.metaTitle || page.title,
    description: page.seo?.metaDescription || `${page.title} for Ahmed Rammah services.`,
    pathname: `/legal/${decodedSlug}`,
    canonicalUrl: page.seo?.canonicalUrl,
    noindex: page.seo?.noindex,
    image: page.seo?.ogImage || getGlobalMedia(globals).defaultOgImage,
  }) : {};
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  return <LegalDocument slug={decodeURIComponent(slug)} requirePublished />;
}
