"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveAdminBlogCategory,
  archiveAdminBlogPost,
  createAdminBlogCategory,
  createAdminBlogPost,
  fetchAdminBlogCategories,
  fetchAdminBlogPosts,
  fetchAdminMediaAssets,
  updateAdminBlogCategory,
  updateAdminBlogPost,
  type AdminBlogCategory,
  type AdminBlogCategoryPayload,
  type AdminBlogPost,
  type AdminBlogPostPayload,
  type AdminMediaAsset,
} from "@/lib/api/admin";
import { MarkdownEditor } from "./MarkdownEditor";
import { MediaPicker } from "./MediaPicker";
import { SeoEditor } from "./SeoEditor";

type BlogMode = "posts" | "categories";

const emptyPost: AdminBlogPostPayload = {
  categoryId: null,
  title: "",
  slug: "",
  excerpt: null,
  body: "",
  featuredMediaAssetId: null,
  status: "draft",
  publishedAt: null,
};
const emptyCategory: AdminBlogCategoryPayload = { name: "", slug: "", status: "draft" };
const validSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
const localDate = (value: string | null | undefined) => value
  ? new Date(value).toISOString().slice(0, 16)
  : "";
const isoDate = (value: string | null | undefined) => value
  ? new Date(value).toISOString()
  : null;

export function BlogEditor() {
  const [mode, setMode] = useState<BlogMode>("posts");
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [categories, setCategories] = useState<AdminBlogCategory[]>([]);
  const [assets, setAssets] = useState<AdminMediaAsset[]>([]);
  const [selectedPost, setSelectedPost] = useState<AdminBlogPost | null>(null);
  const [postForm, setPostForm] = useState<AdminBlogPostPayload>(emptyPost);
  const [featuredImage, setFeaturedImage] = useState<AdminMediaAsset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<AdminBlogCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<AdminBlogCategoryPayload>(emptyCategory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextPosts, nextCategories, nextAssets] = await Promise.all([
        fetchAdminBlogPosts(),
        fetchAdminBlogCategories(),
        fetchAdminMediaAssets({ mediaKind: "image" }),
      ]);
      setPosts(nextPosts);
      setCategories(nextCategories);
      setAssets(nextAssets);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load blog content.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const choosePost = (post: AdminBlogPost) => {
    setSelectedPost(post);
    setPostForm({
      categoryId: post.categoryId,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      body: post.body,
      featuredMediaAssetId: post.featuredMediaAssetId,
      status: post.status,
      publishedAt: localDate(post.publishedAt) || null,
    });
    setFeaturedImage(post.featuredMediaAssetId
      ? assets.filter(({ id }) => id === post.featuredMediaAssetId).slice(0, 1)
      : []);
    setError(null);
  };

  const resetPost = () => {
    setSelectedPost(null);
    setPostForm(emptyPost);
    setFeaturedImage([]);
    setError(null);
  };

  const postIsValid = useMemo(() => Boolean(
    postForm.title.trim()
    && postForm.body.trim()
    && validSlug(postForm.slug)
    && (postForm.status !== "scheduled" || postForm.publishedAt),
  ), [postForm]);

  const savePost = async () => {
    if (!postIsValid) return;
    setBusy(true);
    setError(null);
    try {
      const payload: AdminBlogPostPayload = {
        categoryId: postForm.categoryId || null,
        title: postForm.title.trim(),
        slug: postForm.slug.trim(),
        excerpt: postForm.excerpt?.trim() || null,
        body: postForm.body.trim(),
        featuredMediaAssetId: featuredImage[0]?.id ?? null,
        status: postForm.status,
        publishedAt: isoDate(postForm.publishedAt),
      };
      const saved = selectedPost
        ? await updateAdminBlogPost(selectedPost.id, payload)
        : await createAdminBlogPost(payload);
      await load();
      choosePost(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save post.");
    } finally {
      setBusy(false);
    }
  };

  const archivePost = async () => {
    if (!selectedPost || !window.confirm(`Archive “${selectedPost.title}”?`)) return;
    setBusy(true);
    try {
      await archiveAdminBlogPost(selectedPost.id);
      resetPost();
      await load();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive post.");
    } finally {
      setBusy(false);
    }
  };

  const chooseCategory = (category: AdminBlogCategory) => {
    setSelectedCategory(category);
    setCategoryForm({ name: category.name, slug: category.slug, status: category.status });
    setError(null);
  };

  const resetCategory = () => {
    setSelectedCategory(null);
    setCategoryForm(emptyCategory);
    setError(null);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim() || !validSlug(categoryForm.slug)) return;
    setBusy(true);
    setError(null);
    try {
      if (selectedCategory) await updateAdminBlogCategory(selectedCategory.id, categoryForm);
      else await createAdminBlogCategory(categoryForm);
      resetCategory();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save category.");
    } finally {
      setBusy(false);
    }
  };

  const archiveCategory = async (category: AdminBlogCategory) => {
    if (!window.confirm(`Archive “${category.name}”?`)) return;
    setBusy(true);
    try {
      await archiveAdminBlogCategory(category.id);
      if (selectedCategory?.id === category.id) resetCategory();
      await load();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive category.");
    } finally {
      setBusy(false);
    }
  };

  const activePosts = posts.filter(({ status }) => status !== "archived");
  const activeCategories = categories.filter(({ status }) => status !== "archived");

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">CMS</p>
          <h2 className="mt-2 text-3xl font-semibold">Blog</h2>
          <p className="mt-2 text-sm text-[#102329]/58">Publish articles, organize categories, and control their images and search metadata.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("posts")} className={`border px-4 py-2 text-sm font-semibold ${mode === "posts" ? "border-[#0F3B46] bg-[#0F3B46] text-white" : "border-[#102329]/18"}`}>Posts</button>
          <button type="button" onClick={() => setMode("categories")} className={`border px-4 py-2 text-sm font-semibold ${mode === "categories" ? "border-[#0F3B46] bg-[#0F3B46] text-white" : "border-[#102329]/18"}`}>Categories</button>
        </div>
      </div>
      {error ? <p className="border border-red-700/20 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {mode === "posts" ? (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-2">
            <button type="button" onClick={resetPost} className="w-full border border-[#0F3B46] px-4 py-2 text-sm font-semibold text-[#0F3B46]">New post</button>
            {activePosts.map((post) => <button key={post.id} type="button" onClick={() => choosePost(post)} className={`w-full border p-3 text-left ${selectedPost?.id === post.id ? "border-[#0F3B46] bg-white" : "border-[#102329]/10"}`}><strong className="block text-sm">{post.title}</strong><span className="mt-1 block text-xs text-[#102329]/48">/{post.slug} · {post.status}</span></button>)}
          </aside>
          <div className="space-y-5">
            <article className="space-y-4 border border-[#102329]/12 bg-white p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold">Post title<input aria-label="Post title" value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" /></label>
                <label className="text-xs font-semibold">Post slug<input aria-label="Post slug" value={postForm.slug} onChange={(event) => setPostForm({ ...postForm, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" /></label>
              </div>
              <label className="block text-xs font-semibold">Excerpt<textarea aria-label="Excerpt" value={postForm.excerpt ?? ""} onChange={(event) => setPostForm({ ...postForm, excerpt: event.target.value || null })} rows={3} className="mt-1 w-full border border-[#102329]/18 p-3 text-sm" /></label>
              <MarkdownEditor label="Post body" value={postForm.body} onChange={(body) => setPostForm({ ...postForm, body })} rows={15} />
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs font-semibold">Category<select aria-label="Category" value={postForm.categoryId ?? ""} onChange={(event) => setPostForm({ ...postForm, categoryId: event.target.value || null })} className="mt-1 h-10 w-full border border-[#102329]/18 px-3 text-sm"><option value="">No category</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="text-xs font-semibold">Post status<select aria-label="Post status" value={postForm.status} onChange={(event) => setPostForm({ ...postForm, status: event.target.value as AdminBlogPostPayload["status"] })} className="mt-1 h-10 w-full border border-[#102329]/18 px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select></label>
                <label className="text-xs font-semibold">Publish at<input aria-label="Publish at" type="datetime-local" value={postForm.publishedAt ?? ""} onChange={(event) => setPostForm({ ...postForm, publishedAt: event.target.value || null })} disabled={postForm.status !== "scheduled"} className="mt-1 h-10 w-full border border-[#102329]/18 px-3 text-sm disabled:opacity-40" /></label>
              </div>
              {postForm.status === "scheduled" && !postForm.publishedAt ? <p className="text-xs text-red-700">Choose a publication time for a scheduled post.</p> : null}
              <div className="space-y-2"><p className="text-xs font-semibold">Featured image</p><MediaPicker accepts={["image"]} value={featuredImage} onChange={setFeaturedImage} /></div>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => void savePost()} disabled={busy || !postIsValid} className="bg-[#0F3B46] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{selectedPost ? "Save post" : "Create post"}</button>{selectedPost ? <button type="button" onClick={() => void archivePost()} disabled={busy} className="border border-red-700/40 px-4 py-2 text-sm font-semibold text-red-700">Archive post</button> : null}</div>
            </article>
            {selectedPost ? <SeoEditor resourceType="blog_post" resourceId={selectedPost.id} /> : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-2">{activeCategories.map((category) => <div key={category.id} className="flex items-center gap-3 border border-[#102329]/10 bg-white p-3"><button type="button" onClick={() => chooseCategory(category)} className="min-w-0 flex-1 text-left"><strong className="block text-sm">{category.name}</strong><span className="text-xs text-[#102329]/48">/{category.slug} · {category.status}</span></button><button type="button" aria-label={`Archive ${category.name}`} onClick={() => void archiveCategory(category)} disabled={busy} className="text-xs font-semibold text-red-700">Archive</button></div>)}</div>
          <article className="space-y-3 border border-[#102329]/12 bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">{selectedCategory ? "Edit category" : "New category"}</h3>{selectedCategory ? <button type="button" onClick={resetCategory} className="text-xs font-semibold">New</button> : null}</div><label className="block text-xs font-semibold">Category name<input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} className="mt-1 h-10 w-full border border-[#102329]/18 px-3 text-sm" /></label><label className="block text-xs font-semibold">Category slug<input value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} className="mt-1 h-10 w-full border border-[#102329]/18 px-3 text-sm" /></label><label className="block text-xs font-semibold">Category status<select value={categoryForm.status} onChange={(event) => setCategoryForm({ ...categoryForm, status: event.target.value as AdminBlogCategoryPayload["status"] })} className="mt-1 h-10 w-full border border-[#102329]/18 px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><button type="button" onClick={() => void saveCategory()} disabled={busy || !categoryForm.name.trim() || !validSlug(categoryForm.slug)} className="h-10 w-full bg-[#0F3B46] text-sm font-semibold text-white disabled:opacity-40">{selectedCategory ? "Save category" : "Create category"}</button></article>
        </div>
      )}
    </section>
  );
}
