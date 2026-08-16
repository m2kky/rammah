import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import {
  blogPosts,
  globalMediaAssignments,
  globalMediaAssignmentSets,
  mediaAssets,
  pageSections,
  pages,
  sectionMediaAssignments,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";

const withServer = async (run: (baseUrl: string) => Promise<void>) => {
  const server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}/api/v1/public/cms`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
};

describe.sequential("public CMS media contracts", () => {
  it("resolves named section and global media without exposing storage fields", async () => {
    const { db } = getTestDatabase();
    const [image, video, blogImage] = await db.insert(mediaAssets).values([
      {
        displayName: "Hero",
        fileName: "hero.webp",
        mimeType: "image/webp",
        sourceType: "r2",
        mediaKind: "image",
        storageKey: "tests/hero.webp",
        publicUrl: "https://media.example.test/hero.webp",
        altText: "A coaching session",
        sizeBytes: 1024,
        processingState: "ready",
        status: "published",
      },
      {
        displayName: "Loading",
        fileName: "loading.mp4",
        mimeType: "video/mp4",
        sourceType: "r2",
        mediaKind: "video",
        storageKey: "tests/loading.mp4",
        publicUrl: "https://media.example.test/loading.mp4",
        sizeBytes: 2048,
        processingState: "ready",
        status: "published",
      },
      {
        displayName: "Blog cover",
        fileName: "blog.webp",
        mimeType: "image/webp",
        sourceType: "r2",
        mediaKind: "image",
        storageKey: "tests/blog.webp",
        publicUrl: "https://media.example.test/blog.webp",
        altText: "Article cover",
        sizeBytes: 1536,
        processingState: "ready",
        status: "published",
      },
    ]).returning();
    const [page] = await db.insert(pages).values({
      slug: "leadership",
      title: "Leadership",
      status: "published",
    }).returning();
    const [section] = await db.insert(pageSections).values({
      pageId: page!.id,
      sectionType: "hero",
      title: "Lead with clarity",
      status: "published",
    }).returning();
    await db.insert(sectionMediaAssignments).values({
      pageSectionId: section!.id,
      slotKey: "desktopImage",
      mediaAssetId: image!.id,
      altTextOverride: "Coach Ahmed speaking",
    });
    const [set] = await db.insert(globalMediaAssignmentSets).values({
      definitionKey: "loadingMatchCut",
      version: 1,
      status: "published",
      publishedAt: new Date(),
    }).returning();
    await db.insert(globalMediaAssignments).values({
      assignmentSetId: set!.id,
      slotKey: "video",
      mediaAssetId: video!.id,
      decorative: true,
    });
    await db.insert(blogPosts).values({
      title: "A useful post",
      slug: "a-useful-post",
      body: "Post body",
      featuredMediaAssetId: blogImage!.id,
      status: "published",
      publishedAt: new Date("2030-01-02T09:00:00.000Z"),
    });

    await withServer(async (baseUrl) => {
      const pageResponse = await fetch(`${baseUrl}/pages/leadership`);
      const pageBody = await pageResponse.json() as {
        data: { sections: Array<Record<string, unknown> & { media: Record<string, unknown> }> };
      };
      expect(pageResponse.status).toBe(200);
      expect(pageBody.data.sections[0]!.media.desktopImage).toMatchObject({
        kind: "image",
        publicUrl: "https://media.example.test/hero.webp",
        altText: "Coach Ahmed speaking",
      });
      expect(pageBody.data.sections[0]).not.toHaveProperty("mediaAssetId");
      expect(JSON.stringify(pageBody)).not.toContain("storageKey");

      const globalsResponse = await fetch(`${baseUrl}/media/globals`);
      const globalsBody = await globalsResponse.json() as {
        data: { loadingVideo: Record<string, unknown> };
      };
      expect(globalsResponse.status).toBe(200);
      expect(globalsBody.data.loadingVideo).toMatchObject({
        kind: "video",
        publicUrl: "https://media.example.test/loading.mp4",
        decorative: true,
      });
      expect(JSON.stringify(globalsBody)).not.toContain("storageKey");

      const postsResponse = await fetch(`${baseUrl}/blog/posts`);
      const postsBody = await postsResponse.json() as {
        data: Array<{ featuredMedia: Record<string, unknown> | null }>;
      };
      expect(postsResponse.status).toBe(200);
      expect(postsBody.data[0]!.featuredMedia).toMatchObject({
        kind: "image",
        publicUrl: "https://media.example.test/blog.webp",
        altText: "Article cover",
      });
      expect(JSON.stringify(postsBody)).not.toContain("storageKey");

      const postResponse = await fetch(`${baseUrl}/blog/posts/a-useful-post`);
      const postBody = await postResponse.json() as {
        data: { featuredMedia: Record<string, unknown> | null };
      };
      expect(postResponse.status).toBe(200);
      expect(postBody.data.featuredMedia).toMatchObject({
        kind: "image",
        publicUrl: "https://media.example.test/blog.webp",
      });
      expect(JSON.stringify(postBody)).not.toContain("storageKey");
    });
  });
});
