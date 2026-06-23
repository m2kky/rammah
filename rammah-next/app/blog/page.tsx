import Link from "next/link";
import PublicFrame from "@/components/PublicFrame";
import { fetchPublicBlogPosts, fetchPublicPage, findPublicSection } from "@/lib/api/cms";

const formatDate = (value: string | null) => {
  if (!value) return "Draft date";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
};

export const metadata = {
  title: "Blog | Ahmed Rammah",
  description: "Essays and notes on psychology, systems, coaching, and aCRL.",
};

export default async function BlogPage() {
  const [posts, page] = await Promise.all([
    fetchPublicBlogPosts().catch(() => []),
    fetchPublicPage("blog").catch(() => null)
  ]);

  const headerSec = findPublicSection(page, "header");
  const headerTitle = headerSec?.title || "Notes from the system.";
  const headerBody = headerSec?.body || "Practical writing on behavior, decoding, training, and the work behind meaningful change.";

  return (
    <PublicFrame>
      <section className="min-h-[72svh] bg-[#02040A] px-5 pb-16 pt-28 md:px-8 md:pt-36">
        <div className="mx-auto max-w-[1440px]">
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-white/52">
            Blog
          </p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <h1 className="text-[clamp(4.2rem,13vw,13rem)] font-extrabold leading-[0.82] tracking-normal">
              {headerTitle}
            </h1>
            <p className="max-w-xl font-inter text-base leading-7 text-white/64 md:text-lg">
              {headerBody}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 text-[#102329] md:px-8 md:py-20">
        <div className="mx-auto max-w-[1440px]">
          {posts.length === 0 ? (
            <div className="border-t border-[#102329]/14 pt-8">
              <h2 className="text-4xl font-semibold">No published posts yet.</h2>
              <p className="mt-4 max-w-xl font-inter text-sm leading-7 text-[#102329]/62">
                The blog route is ready. Published CMS posts will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="grid gap-5 border-t border-[#102329]/14 py-8 lg:grid-cols-[0.35fr_1fr_0.2fr] lg:items-start"
                >
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
                    {formatDate(post.publishedAt)}
                  </p>
                  <div>
                    <h2 className="text-4xl font-semibold leading-[0.95] md:text-6xl">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="mt-4 max-w-3xl font-inter text-sm leading-7 text-[#102329]/64">
                        {post.excerpt}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="w-fit rounded-full bg-[#0F3B46] px-5 py-2 font-inter text-xs font-semibold text-white transition-opacity hover:opacity-90 lg:justify-self-end"
                  >
                    Read
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicFrame>
  );
}
