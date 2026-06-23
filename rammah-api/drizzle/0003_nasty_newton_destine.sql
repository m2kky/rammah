ALTER TABLE "bookings" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_location_id_offline_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."offline_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_location_idx" ON "bookings" USING btree ("location_id");