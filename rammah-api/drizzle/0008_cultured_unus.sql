CREATE TYPE "public"."availability_override_mode" AS ENUM('unavailable', 'available');--> statement-breakpoint
CREATE TYPE "public"."program_occurrence_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."scheduling_mode" AS ENUM('appointment', 'scheduled_program');--> statement-breakpoint
CREATE TABLE "availability_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekday" integer NOT NULL,
	"start_local_time" varchar(8) NOT NULL,
	"end_local_time" varchar(8) NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_windows_valid_window" CHECK ("availability_windows"."weekday" BETWEEN 0 AND 6 AND "availability_windows"."start_local_time" < "availability_windows"."end_local_time")
);
--> statement-breakpoint
CREATE TABLE "global_availability_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" varchar(10) NOT NULL,
	"override_mode" "availability_override_mode" NOT NULL,
	"start_local_time" varchar(8),
	"end_local_time" varchar(8),
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "global_availability_overrides_valid_shape" CHECK (("global_availability_overrides"."override_mode" = 'unavailable' AND "global_availability_overrides"."start_local_time" IS NULL AND "global_availability_overrides"."end_local_time" IS NULL) OR ("global_availability_overrides"."override_mode" = 'available' AND "global_availability_overrides"."start_local_time" IS NOT NULL AND "global_availability_overrides"."end_local_time" IS NOT NULL AND "global_availability_overrides"."start_local_time" < "global_availability_overrides"."end_local_time"))
);
--> statement-breakpoint
CREATE TABLE "scheduled_program_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_program_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" varchar(80) NOT NULL,
	"attendance_mode" "attendance_mode" NOT NULL,
	"location_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"google_calendar_event_id" text,
	"meet_url" text,
	"status" "program_occurrence_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_program_occurrences_valid_interval" CHECK ("scheduled_program_occurrences"."starts_at" < "scheduled_program_occurrences"."ends_at"),
	CONSTRAINT "scheduled_program_occurrences_sort_order_non_negative" CHECK ("scheduled_program_occurrences"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scheduled_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offering_id" uuid NOT NULL,
	"title" varchar(220) NOT NULL,
	"timezone" varchar(80) NOT NULL,
	"attendance_mode" "attendance_mode" NOT NULL,
	"location_id" uuid,
	"capacity" integer NOT NULL,
	"registration_opens_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_programs_capacity_positive" CHECK ("scheduled_programs"."capacity" > 0),
	CONSTRAINT "scheduled_programs_valid_registration_window" CHECK ("scheduled_programs"."registration_opens_at" IS NULL OR "scheduled_programs"."registration_closes_at" IS NULL OR "scheduled_programs"."registration_opens_at" < "scheduled_programs"."registration_closes_at")
);
--> statement-breakpoint
ALTER TABLE "booking_slot_holds" DROP CONSTRAINT "booking_slot_holds_valid_slot_interval";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_valid_slot_interval";--> statement-breakpoint
ALTER TABLE "booking_slot_holds" ALTER COLUMN "slot_start_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_slot_holds" ALTER COLUMN "slot_end_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "offerings" ALTER COLUMN "duration_minutes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_slot_holds" ADD COLUMN "scheduled_program_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "scheduled_program_id" uuid;--> statement-breakpoint
ALTER TABLE "offerings" ADD COLUMN "scheduling_mode" "scheduling_mode" DEFAULT 'appointment' NOT NULL;--> statement-breakpoint
ALTER TABLE "offerings" ADD COLUMN "buffer_before_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "offerings" ADD COLUMN "buffer_after_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_program_occurrences" ADD CONSTRAINT "scheduled_program_occurrences_scheduled_program_id_scheduled_programs_id_fk" FOREIGN KEY ("scheduled_program_id") REFERENCES "public"."scheduled_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_program_occurrences" ADD CONSTRAINT "scheduled_program_occurrences_location_id_offline_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."offline_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_programs" ADD CONSTRAINT "scheduled_programs_offering_id_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."offerings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_programs" ADD CONSTRAINT "scheduled_programs_location_id_offline_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."offline_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_windows_weekday_status_idx" ON "availability_windows" USING btree ("weekday","status");--> statement-breakpoint
CREATE UNIQUE INDEX "availability_windows_unique" ON "availability_windows" USING btree ("weekday","start_local_time","end_local_time","status");--> statement-breakpoint
CREATE INDEX "global_availability_overrides_date_mode_idx" ON "global_availability_overrides" USING btree ("date","override_mode");--> statement-breakpoint
CREATE INDEX "scheduled_program_occurrences_program_starts_idx" ON "scheduled_program_occurrences" USING btree ("scheduled_program_id","starts_at");--> statement-breakpoint
CREATE INDEX "scheduled_programs_offering_status_idx" ON "scheduled_programs" USING btree ("offering_id","status");--> statement-breakpoint
ALTER TABLE "booking_slot_holds" ADD CONSTRAINT "booking_slot_holds_scheduled_program_id_scheduled_programs_id_fk" FOREIGN KEY ("scheduled_program_id") REFERENCES "public"."scheduled_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_scheduled_program_id_scheduled_programs_id_fk" FOREIGN KEY ("scheduled_program_id") REFERENCES "public"."scheduled_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_slot_holds_program_idx" ON "booking_slot_holds" USING btree ("scheduled_program_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "bookings_program_status_idx" ON "bookings" USING btree ("scheduled_program_id","status");--> statement-breakpoint
DO $$
DECLARE
	blocked_ids text;
BEGIN
	SELECT string_agg(o.id::text, ', ' ORDER BY o.id::text)
	INTO blocked_ids
	FROM offerings o
	WHERE EXISTS (
		SELECT 1
		FROM availability_rules ar
		WHERE ar.offering_id = o.id
			AND ar.status = 'published'
	)
	AND EXISTS (
		SELECT 1
		FROM offering_sessions os
		WHERE os.offering_id = o.id
			AND os.status = 'published'
			AND os.ends_at > now()
	);

	IF blocked_ids IS NOT NULL THEN
		RAISE EXCEPTION 'A2 scheduling migration blocked: Offerings have both published recurring availability and active fixed sessions: %', blocked_ids;
	END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE
	blocked_ids text;
BEGIN
	SELECT string_agg(inconsistent.offering_id::text, ', ' ORDER BY inconsistent.offering_id::text)
	INTO blocked_ids
	FROM (
		SELECT offering_id
		FROM availability_rules
		WHERE status = 'published'
		GROUP BY offering_id
		HAVING count(DISTINCT (timezone, slot_duration_minutes, buffer_before_minutes, buffer_after_minutes)) > 1
	) inconsistent;

	IF blocked_ids IS NOT NULL THEN
		RAISE EXCEPTION 'A2 scheduling migration blocked: Offerings have inconsistent recurring duration, buffers, or timezone: %', blocked_ids;
	END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE
	blocked_ids text;
BEGIN
	WITH distinct_windows AS (
		SELECT DISTINCT offering_id, weekday, start_time, end_time, timezone
		FROM availability_rules
		WHERE status = 'published'
	), per_offering AS (
		SELECT
			offering_id,
			string_agg(
				concat_ws('|', weekday::text, start_time, end_time, timezone),
				',' ORDER BY weekday, start_time, end_time, timezone
			) AS signature
		FROM distinct_windows
		GROUP BY offering_id
	)
	SELECT string_agg(per_offering.offering_id::text, ', ' ORDER BY per_offering.offering_id::text)
	INTO blocked_ids
	FROM per_offering
	WHERE (SELECT count(DISTINCT signature) FROM per_offering) > 1;

	IF blocked_ids IS NOT NULL THEN
		RAISE EXCEPTION 'A2 scheduling migration blocked: published recurring schedules cannot be consolidated globally for Offerings: %', blocked_ids;
	END IF;
END $$;--> statement-breakpoint
DO $$
DECLARE
	blocked_booking_ids text;
	blocked_offering_ids text;
BEGIN
	SELECT string_agg(id::text, ', ' ORDER BY id::text)
	INTO blocked_booking_ids
	FROM bookings
	WHERE offering_session_id IS NULL
		AND (slot_start_at IS NULL OR slot_end_at IS NULL OR slot_start_at >= slot_end_at);

	IF blocked_booking_ids IS NOT NULL THEN
		RAISE EXCEPTION 'A2 scheduling migration blocked: bookings have no resolvable scheduling target: %', blocked_booking_ids;
	END IF;

	SELECT string_agg(id::text, ', ' ORDER BY id::text)
	INTO blocked_offering_ids
	FROM offerings
	WHERE duration_minutes IS NULL OR duration_minutes <= 0;

	IF blocked_offering_ids IS NOT NULL THEN
		RAISE EXCEPTION 'A2 scheduling migration blocked: Offerings have invalid legacy duration: %', blocked_offering_ids;
	END IF;
END $$;--> statement-breakpoint
INSERT INTO "availability_windows" (
	"weekday",
	"start_local_time",
	"end_local_time",
	"status",
	"created_at",
	"updated_at"
)
SELECT
	weekday,
	start_time,
	end_time,
	'published'::content_status,
	min(created_at),
	max(updated_at)
FROM availability_rules
WHERE status = 'published'
GROUP BY weekday, start_time, end_time;--> statement-breakpoint
INSERT INTO "scheduled_programs" (
	"id",
	"offering_id",
	"title",
	"timezone",
	"attendance_mode",
	"location_id",
	"capacity",
	"status",
	"created_at",
	"updated_at"
)
SELECT
	os.id,
	os.offering_id,
	o.title,
	os.timezone,
	os.attendance_mode,
	os.location_id,
	os.capacity,
	os.status,
	os.created_at,
	os.updated_at
FROM offering_sessions os
JOIN offerings o ON o.id = os.offering_id;--> statement-breakpoint
INSERT INTO "scheduled_program_occurrences" (
	"id",
	"scheduled_program_id",
	"starts_at",
	"ends_at",
	"timezone",
	"attendance_mode",
	"location_id",
	"sort_order",
	"google_calendar_event_id",
	"status",
	"created_at",
	"updated_at"
)
SELECT
	os.id,
	os.id,
	os.starts_at,
	os.ends_at,
	os.timezone,
	os.attendance_mode,
	os.location_id,
	0,
	os.google_calendar_event_id,
	CASE WHEN os.status = 'archived' THEN 'cancelled'::program_occurrence_status ELSE 'scheduled'::program_occurrence_status END,
	os.created_at,
	os.updated_at
FROM offering_sessions os;--> statement-breakpoint
UPDATE bookings
SET
	scheduled_program_id = offering_session_id,
	slot_start_at = NULL,
	slot_end_at = NULL
WHERE offering_session_id IS NOT NULL;--> statement-breakpoint
UPDATE booking_slot_holds
SET
	scheduled_program_id = offering_session_id,
	slot_start_at = NULL,
	slot_end_at = NULL
WHERE offering_session_id IS NOT NULL;--> statement-breakpoint
WITH rule_truth AS (
	SELECT DISTINCT ON (offering_id)
		offering_id,
		slot_duration_minutes,
		buffer_before_minutes,
		buffer_after_minutes
	FROM availability_rules
	WHERE status = 'published'
	ORDER BY offering_id, id
)
UPDATE offerings o
SET
	scheduling_mode = 'appointment',
	duration_minutes = rule_truth.slot_duration_minutes,
	buffer_before_minutes = rule_truth.buffer_before_minutes,
	buffer_after_minutes = rule_truth.buffer_after_minutes
FROM rule_truth
WHERE o.id = rule_truth.offering_id;--> statement-breakpoint
UPDATE offerings o
SET
	scheduling_mode = 'scheduled_program',
	duration_minutes = NULL,
	buffer_before_minutes = 0,
	buffer_after_minutes = 0
WHERE EXISTS (
	SELECT 1
	FROM offering_sessions os
	WHERE os.offering_id = o.id
		AND os.status = 'published'
		AND os.ends_at > now()
);--> statement-breakpoint
ALTER TABLE "booking_slot_holds" ADD CONSTRAINT "booking_slot_holds_valid_scheduling_target" CHECK (("booking_slot_holds"."scheduled_program_id" IS NULL AND "booking_slot_holds"."slot_start_at" IS NOT NULL AND "booking_slot_holds"."slot_end_at" IS NOT NULL AND "booking_slot_holds"."slot_start_at" < "booking_slot_holds"."slot_end_at") OR ("booking_slot_holds"."scheduled_program_id" IS NOT NULL AND "booking_slot_holds"."slot_start_at" IS NULL AND "booking_slot_holds"."slot_end_at" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_valid_scheduling_target" CHECK (("bookings"."scheduled_program_id" IS NULL AND "bookings"."slot_start_at" IS NOT NULL AND "bookings"."slot_end_at" IS NOT NULL AND "bookings"."slot_start_at" < "bookings"."slot_end_at") OR ("bookings"."scheduled_program_id" IS NOT NULL AND "bookings"."slot_start_at" IS NULL AND "bookings"."slot_end_at" IS NULL));--> statement-breakpoint
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_valid_scheduling_configuration" CHECK ((("offerings"."scheduling_mode" = 'appointment' AND "offerings"."duration_minutes" IS NOT NULL AND "offerings"."duration_minutes" > 0) OR ("offerings"."scheduling_mode" = 'scheduled_program' AND "offerings"."duration_minutes" IS NULL)) AND "offerings"."buffer_before_minutes" >= 0 AND "offerings"."buffer_after_minutes" >= 0);
