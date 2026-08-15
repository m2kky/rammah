import { NextRequest, NextResponse } from "next/server";
import { fetchPreviewPage } from "../../lib/api/cms";

export const runtime = "nodejs";
const cookieName = "rammah_cms_preview";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const pageId = request.nextUrl.searchParams.get("pageId") ?? "";
  const expiresAt = request.nextUrl.searchParams.get("expiresAt");
  if (!token || !pageId) return NextResponse.json({ error: "Missing preview credentials." }, { status: 400 });
  const page = await fetchPreviewPage(pageId, token).catch(() => null);
  if (!page) return NextResponse.json({ error: "Preview link is invalid or expired." }, { status: 401 });
  const response = NextResponse.redirect(new URL(`/preview/${encodeURIComponent(page.slug)}`, request.url));
  const requestedLifetime = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1_000) : 300;
  const maxAge = Number.isFinite(requestedLifetime) ? Math.max(1, Math.min(3_600, requestedLifetime)) : 300;
  response.cookies.set(cookieName, Buffer.from(JSON.stringify({ token, pageId, slug: page.slug })).toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/preview",
    maxAge,
  });
  return response;
}

export async function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/preview", maxAge: 0 });
  return response;
}
