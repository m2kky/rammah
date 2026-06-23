ALTER TABLE "offerings" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "offerings" ADD COLUMN "display_config" jsonb DEFAULT '{}'::jsonb NOT NULL;