CREATE TYPE "public"."google_calendar_connection_status" AS ENUM('connected', 'disconnected', 'error');--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'processing' BEFORE 'paid';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'abandoned' BEFORE 'cancelled';--> statement-breakpoint
CREATE TABLE "google_calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(80) DEFAULT 'google' NOT NULL,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_type" varchar(80),
	"scope" text,
	"expiry_date" timestamp with time zone,
	"connected_email" varchar(255),
	"status" "google_calendar_connection_status" DEFAULT 'disconnected' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_connections_provider_unique" ON "google_calendar_connections" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_booking_provider_unique" ON "calendar_events" USING btree ("booking_id","provider");--> statement-breakpoint
CREATE INDEX "calendar_events_booking_idx" ON "calendar_events" USING btree ("booking_id");