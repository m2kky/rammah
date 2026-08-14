DO $$
BEGIN
	IF (SELECT count(*) FROM "site_settings") > 1 THEN
		RAISE EXCEPTION 'duplicate site_settings rows require explicit operator resolution before booking policy migration';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "settings_key" varchar(32) DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "booking_minimum_advance_days" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "site_settings_settings_key_unique" ON "site_settings" USING btree ("settings_key");--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_global_key" CHECK ("site_settings"."settings_key" = 'global');--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_booking_minimum_advance_days_range" CHECK ("site_settings"."booking_minimum_advance_days" BETWEEN 1 AND 365);
