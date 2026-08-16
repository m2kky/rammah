DO $$
DECLARE
  offending_ids text;
BEGIN
  SELECT string_agg(p.id::text, ', ' ORDER BY p.id)
  INTO offending_ids
  FROM offering_prices p
  WHERE p.status <> 'archived'
    AND EXISTS (
      SELECT 1
      FROM offering_prices duplicate
      WHERE duplicate.offering_id = p.offering_id
        AND duplicate.country_code = p.country_code
        AND duplicate.status <> 'archived'
        AND duplicate.id <> p.id
    );
  IF offending_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate active offering country prices: %', offending_ids;
  END IF;

  SELECT string_agg(id::text, ', ' ORDER BY id)
  INTO offending_ids
  FROM offering_prices
  WHERE country_code !~ '^[A-Z]{2}$';
  IF offending_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid offering price country codes: %', offending_ids;
  END IF;

  SELECT string_agg(id::text, ', ' ORDER BY id)
  INTO offending_ids
  FROM offering_prices
  WHERE base_amount_minor < 0
    OR (early_bird_amount_minor IS NOT NULL AND early_bird_amount_minor < 0);
  IF offending_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Negative offering price amounts: %', offending_ids;
  END IF;

  SELECT string_agg(p.id::text, ', ' ORDER BY p.id)
  INTO offending_ids
  FROM offering_prices p
  INNER JOIN offerings o ON o.id = p.offering_id
  WHERE p.status = 'published'
    AND p.base_amount_minor = 0
    AND (o.requires_payment OR o.booking_mode = 'paid');
  IF offending_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Published paid offering prices must be positive: %', offending_ids;
  END IF;

  SELECT string_agg(id::text, ', ' ORDER BY id)
  INTO offending_ids
  FROM offering_prices
  WHERE (early_bird_amount_minor IS NULL) <> (early_bird_ends_at IS NULL);
  IF offending_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Incomplete early booking price pairs: %', offending_ids;
  END IF;

  SELECT string_agg(id::text, ', ' ORDER BY id)
  INTO offending_ids
  FROM offering_prices
  WHERE early_bird_amount_minor IS NOT NULL
    AND early_bird_ends_at IS NOT NULL
    AND (
      early_bird_amount_minor >= base_amount_minor
      OR (status = 'published' AND early_bird_amount_minor <= 0)
    );
  IF offending_ids IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid early booking price amounts: %', offending_ids;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "offering_prices" ADD COLUMN "name" varchar(120);
--> statement-breakpoint
UPDATE "offering_prices"
SET "name" = CASE "country_code"
  WHEN 'EG' THEN 'Egypt'
  WHEN 'US' THEN 'United States'
  ELSE "country_code"
END;
--> statement-breakpoint
ALTER TABLE "offering_prices" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "offering_prices_id_offering_unique"
  ON "offering_prices" USING btree ("id", "offering_id");
--> statement-breakpoint
CREATE TABLE "offering_price_countries" (
  "price_id" uuid NOT NULL,
  "offering_id" uuid NOT NULL,
  "country_code" varchar(2) NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "offering_price_countries_pk" PRIMARY KEY("price_id", "country_code"),
  CONSTRAINT "offering_price_countries_country_format" CHECK ("country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "offering_price_countries_price_offering_fk"
    FOREIGN KEY ("price_id", "offering_id")
    REFERENCES "public"."offering_prices"("id", "offering_id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
INSERT INTO "offering_price_countries" ("price_id", "offering_id", "country_code", "active")
SELECT "id", "offering_id", "country_code", "status" <> 'archived'
FROM "offering_prices";
--> statement-breakpoint
INSERT INTO "audit_logs" (
  "action",
  "resource_type",
  "resource_id",
  "before_snapshot",
  "after_snapshot"
)
SELECT
  'migration.offering_prices.scheduled_to_draft',
  'offering_price',
  "id",
  jsonb_build_object('status', 'scheduled'),
  jsonb_build_object('status', 'draft')
FROM "offering_prices"
WHERE "status" = 'scheduled';
--> statement-breakpoint
UPDATE "offering_prices" SET "status" = 'draft' WHERE "status" = 'scheduled';
--> statement-breakpoint
DROP INDEX "offering_prices_country_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "offering_price_countries_active_unique"
  ON "offering_price_countries" USING btree ("offering_id", "country_code")
  WHERE "active" = true;
--> statement-breakpoint
CREATE INDEX "offering_price_countries_price_idx"
  ON "offering_price_countries" USING btree ("price_id");
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "offering_price_id" uuid;
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_offering_price_offering_fk"
  FOREIGN KEY ("offering_price_id", "offering_id")
  REFERENCES "public"."offering_prices"("id", "offering_id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "bookings_offering_price_idx"
  ON "bookings" USING btree ("offering_price_id");
