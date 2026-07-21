CREATE TYPE "public"."outbox_state" AS ENUM('queued', 'processing', 'completed', 'dead_letter');--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(160) NOT NULL,
	"aggregate_type" varchar(120) NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"state" "outbox_state" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"lock_token" uuid,
	"processed_at" timestamp with time zone,
	"last_error" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_events_idempotency_unique" ON "outbox_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "outbox_events" USING btree ("state","available_at","created_at","id");--> statement-breakpoint
CREATE INDEX "outbox_events_lease_idx" ON "outbox_events" USING btree ("state","locked_at");--> statement-breakpoint
CREATE INDEX "outbox_events_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");