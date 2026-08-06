CREATE TYPE "public"."media_kind" AS ENUM('image', 'video', 'animation_bundle');--> statement-breakpoint
CREATE TYPE "public"."media_processing_state" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_source" AS ENUM('r2', 'external');--> statement-breakpoint
CREATE TABLE "global_media_assignment_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_key" varchar(120) NOT NULL,
	"version" integer NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "global_media_assignment_sets_version_positive" CHECK ("global_media_assignment_sets"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "global_media_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_set_id" uuid NOT NULL,
	"slot_key" varchar(120) NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"alt_text_override" text,
	"decorative" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "global_media_assignments_order_nonnegative" CHECK ("global_media_assignments"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "section_media_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_section_id" uuid NOT NULL,
	"slot_key" varchar(120) NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"alt_text_override" text,
	"decorative" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_media_assignments_order_nonnegative" CHECK ("section_media_assignments"."sort_order" >= 0)
);
--> statement-breakpoint
DROP INDEX "media_assets_status_idx";--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "storage_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "display_name" text;--> statement-breakpoint
UPDATE "media_assets" SET "display_name" = "file_name" WHERE "display_name" IS NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "display_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "source_type" "media_source" DEFAULT 'r2' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "media_kind" "media_kind" DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "processing_state" "media_processing_state" DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "processing_error" text;--> statement-breakpoint
UPDATE "media_assets"
SET "source_type" = CASE
	WHEN "public_url" ~ '^https://' THEN 'external'::"media_source"
	ELSE 'r2'::"media_source"
END;--> statement-breakpoint
UPDATE "media_assets"
SET "media_kind" = CASE
	WHEN "mime_type" LIKE 'video/%' THEN 'video'::"media_kind"
	ELSE 'image'::"media_kind"
END;--> statement-breakpoint
ALTER TABLE "global_media_assignments" ADD CONSTRAINT "global_media_assignments_assignment_set_id_global_media_assignment_sets_id_fk" FOREIGN KEY ("assignment_set_id") REFERENCES "public"."global_media_assignment_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_media_assignments" ADD CONSTRAINT "global_media_assignments_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_media_assignments" ADD CONSTRAINT "section_media_assignments_page_section_id_page_sections_id_fk" FOREIGN KEY ("page_section_id") REFERENCES "public"."page_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_media_assignments" ADD CONSTRAINT "section_media_assignments_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "section_media_assignments"
	("page_section_id", "slot_key", "media_asset_id", "sort_order", "decorative")
SELECT
	"id",
	CASE lower(replace("section_type", '-', '_'))
		WHEN 'hero' THEN 'desktopImage'
		WHEN 'image_with_text' THEN 'image'
		WHEN 'standalone_image' THEN 'image'
		WHEN 'video' THEN 'video'
		WHEN 'gallery' THEN 'galleryImages'
		WHEN 'cta' THEN 'backgroundImage'
		ELSE 'primaryMedia'
	END,
	"media_asset_id",
	0,
	false
FROM "page_sections"
WHERE "media_asset_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
CREATE UNIQUE INDEX "global_media_assignment_sets_definition_version_unique" ON "global_media_assignment_sets" USING btree ("definition_key","version");--> statement-breakpoint
CREATE UNIQUE INDEX "global_media_assignment_sets_one_published_version" ON "global_media_assignment_sets" USING btree ("definition_key") WHERE "global_media_assignment_sets"."status" = 'published';--> statement-breakpoint
CREATE INDEX "global_media_assignment_sets_definition_status_idx" ON "global_media_assignment_sets" USING btree ("definition_key","status");--> statement-breakpoint
CREATE UNIQUE INDEX "global_media_assignments_slot_order_unique" ON "global_media_assignments" USING btree ("assignment_set_id","slot_key","sort_order");--> statement-breakpoint
CREATE INDEX "global_media_assignments_asset_idx" ON "global_media_assignments" USING btree ("media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "section_media_assignments_slot_order_unique" ON "section_media_assignments" USING btree ("page_section_id","slot_key","sort_order");--> statement-breakpoint
CREATE INDEX "section_media_assignments_asset_idx" ON "section_media_assignments" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "media_assets_source_kind_idx" ON "media_assets" USING btree ("source_type","media_kind");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status","processing_state");--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size_nonnegative" CHECK ("media_assets"."size_bytes" >= 0);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_width_positive" CHECK ("media_assets"."width" IS NULL OR "media_assets"."width" > 0);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_height_positive" CHECK ("media_assets"."height" IS NULL OR "media_assets"."height" > 0);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_duration_nonnegative" CHECK ("media_assets"."duration_ms" IS NULL OR "media_assets"."duration_ms" >= 0);--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_source_fields" CHECK (("media_assets"."source_type" = 'r2' AND "media_assets"."storage_key" IS NOT NULL) OR ("media_assets"."source_type" = 'external' AND "media_assets"."public_url" ~ '^https://'));
