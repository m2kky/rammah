import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GenericPage } from "../../components/cms/GenericPage";
import { fetchPublicPage } from "../../lib/api/cms";
import { getPageMetadata } from "../../lib/api/cms-content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPublicPage(decodeURIComponent(slug)).catch(() => null);
  if (!page) return {};
  const metadata = getPageMetadata(page, page.title, "");
  return {
    ...metadata,
    ...(page.seo?.ogImage?.publicUrl ? { openGraph: { images: [page.seo.ogImage.publicUrl] } } : {}),
  };
}

export default async function CmsPublicPage({ params }: Props) {
  const { slug } = await params;
  const page = await fetchPublicPage(decodeURIComponent(slug)).catch(() => null);
  if (!page || page.template !== "default") notFound();
  return <GenericPage page={page} />;
}
