import type { Metadata } from "next";
import LegalDocument from "../../../components/LegalDocument";
import { fetchPublicLegalPage } from "../../../lib/api/cms";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPublicLegalPage(decodeURIComponent(slug)).catch(() => null);
  return page ? {
    title: page.seo?.metaTitle || page.title,
    description: page.seo?.metaDescription || undefined,
    alternates: page.seo?.canonicalUrl ? { canonical: page.seo.canonicalUrl } : undefined,
    robots: page.seo?.noindex ? { index: false, follow: false } : undefined,
    openGraph: page.seo?.ogImage?.publicUrl ? { images: [page.seo.ogImage.publicUrl] } : undefined,
  } : {};
}

export default async function LegalPage({ params }: Props) {
  const { slug } = await params;
  return <LegalDocument slug={decodeURIComponent(slug)} requirePublished />;
}
