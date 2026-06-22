import Link from "next/link";
import { notFound } from "next/navigation";
import PublicFrame from "@/components/PublicFrame";
import { fetchPublicBlogPost } from "@/lib/api/cms";

const formatDate = (value: string | null) => {
  if (!value) return "Published";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
};

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPublicBlogPost(decodeURIComponent(slug)).catch(() => null);

  if (!post) notFound();

  return (
    <PublicFrame>
      <article className="bg-white px-5 pb-20 pt-28 text-[#102329] md:px-8 md:pt-36">
        <div className="mx-auto max-w-5xl">
          <Link href="/blog" className="font-inter text-sm font-semibold text-[#0F3B46]">
            Back to blog
          </Link>
          <p className="mt-10 font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#102329]/45">
            {post.category?.name ?? "Essay"} · {formatDate(post.publishedAt)}
          </p>
          <h1 className="mt-5 text-[clamp(3.5rem,10vw,9rem)] font-extrabold leading-[0.85] tracking-normal">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-8 max-w-3xl font-inter text-lg leading-8 text-[#102329]/64">
              {post.excerpt}
            </p>
          )}
          <div className="mt-12 whitespace-pre-wrap border-t border-[#102329]/14 pt-8 font-inter text-base leading-8 text-[#102329]/76">
            {post.body}
          </div>
          <div className="mt-12 flex flex-wrap gap-3 border-t border-[#102329]/14 pt-8">
            <Link
              href="/booking"
              className="rounded-full bg-[#0F3B46] px-6 py-3 font-inter text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Book a session
            </Link>
            <Link
              href="/contact"
              className="rounded-full border border-[#102329]/18 px-6 py-3 font-inter text-sm font-semibold text-[#102329] transition-colors hover:border-[#0F3B46]"
            >
              Contact
            </Link>
          </div>
        </div>
      </article>
    </PublicFrame>
  );
}
