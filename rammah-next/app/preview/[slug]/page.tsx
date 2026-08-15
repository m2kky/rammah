import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { GenericPage } from "../../../components/cms/GenericPage";
import { PreviewToolbar } from "../../../components/cms/PreviewToolbar";
import { fetchPreviewPage } from "../../../lib/api/cms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
const cookieName = "rammah_cms_preview";

type PreviewCookie = { token: string; pageId: string; slug: string };

const readPreviewCookie = async (): Promise<PreviewCookie | null> => {
  const encoded = (await cookies()).get(cookieName)?.value;
  if (!encoded) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<PreviewCookie>;
    return value.token && value.pageId && value.slug ? value as PreviewCookie : null;
  } catch { return null; }
};

export default async function CmsPreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const credential = await readPreviewCookie();
  if (!credential || credential.slug !== decodeURIComponent(slug)) notFound();
  const page = await fetchPreviewPage(credential.pageId, credential.token).catch(() => null);
  if (!page) notFound();
  return <><GenericPage page={page} preview /><PreviewToolbar publicUrl={`/${page.slug}`} /></>;
}
