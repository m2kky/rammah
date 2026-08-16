import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GenericPage } from "../../components/cms/GenericPage";
import { fetchPublicGlobalMedia, fetchPublicPage } from "../../lib/api/cms";
import { getGlobalMedia, getPageMetadata } from "../../lib/api/cms-content";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const [page, globals] = await Promise.all([
    fetchPublicPage(decodedSlug).catch(() => null),
    fetchPublicGlobalMedia().catch(() => null),
  ]);
  if (!page) return {};
  return getPageMetadata(
    page,
    page.title,
    "Insights, services, and resources from Ahmed Rammah.",
    `/${decodedSlug}`,
    getGlobalMedia(globals).defaultOgImage,
  );
}

export default async function CmsPublicPage({ params }: Props) {
  const { slug } = await params;
  const page = await fetchPublicPage(decodeURIComponent(slug)).catch(() => null);
  if (!page || page.template !== "default") notFound();
  return <GenericPage page={page} />;
}
