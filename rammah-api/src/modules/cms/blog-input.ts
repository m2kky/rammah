import { z } from "zod";

const contentStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);

export const blogSlugSchema = z.string().trim().min(1).max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase single-segment slug.");

export const blogCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: blogSlugSchema,
  status: contentStatusSchema.default("draft"),
});

const blogPostFieldsSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(220),
  slug: blogSlugSchema,
  excerpt: z.string().trim().nullable().optional(),
  body: z.string().trim().min(1),
  featuredMediaAssetId: z.string().uuid().nullable().optional(),
  status: contentStatusSchema.default("draft"),
  publishedAt: z.string().datetime().nullable().optional(),
});

const addScheduledPublicationIssue = (
  value: { status?: z.infer<typeof contentStatusSchema>; publishedAt?: string | null },
  context: z.RefinementCtx,
) => {
  if (value.status === "scheduled" && !value.publishedAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publishedAt"],
      message: "Choose a publication time for a scheduled post.",
    });
  }
};

export const blogPostBodySchema = blogPostFieldsSchema.superRefine(addScheduledPublicationIssue);

export const blogPostPatchSchema = blogPostFieldsSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: "At least one field is required." },
);

export const isScheduledBlogPublicationValid = (
  status: z.infer<typeof contentStatusSchema>,
  publishedAt: string | Date | null | undefined,
) => status !== "scheduled" || Boolean(publishedAt);
