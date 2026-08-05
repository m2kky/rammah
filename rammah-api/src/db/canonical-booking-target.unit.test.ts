import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(new URL("./schema/index.ts", import.meta.url), "utf8");

describe("canonical booking target schema", () => {
  it("makes the scheduling model explicit on offerings", () => {
    expect(schemaSource).toContain(
      'pgEnum("scheduling_mode", ["appointment", "scheduled_program"])',
    );
    expect(schemaSource).toContain(
      'schedulingMode: schedulingModeEnum("scheduling_mode").notNull().default("appointment")',
    );
    expect(schemaSource).toContain('bufferBeforeMinutes: integer("buffer_before_minutes")');
    expect(schemaSource).toContain('bufferAfterMinutes: integer("buffer_after_minutes")');
    expect(schemaSource).toContain("offerings_valid_scheduling_configuration");
  });

  it("defines reusable global availability windows and overrides", () => {
    expect(schemaSource).toContain('availabilityWindows = pgTable(\n  "availability_windows"');
    expect(schemaSource).toContain('startLocalTime: varchar("start_local_time"');
    expect(schemaSource).toContain('endLocalTime: varchar("end_local_time"');
    expect(schemaSource).toContain(
      'globalAvailabilityOverrides = pgTable(\n  "global_availability_overrides"',
    );
    expect(schemaSource).toContain(
      'pgEnum("availability_override_mode", ["unavailable", "available"])',
    );
    expect(schemaSource).toContain("global_availability_overrides_valid_shape");
  });

  it("defines programs and independently cancellable occurrences", () => {
    expect(schemaSource).toContain('scheduledPrograms = pgTable(\n  "scheduled_programs"');
    expect(schemaSource).toContain(
      'scheduledProgramOccurrences = pgTable(\n  "scheduled_program_occurrences"',
    );
    expect(schemaSource).toContain(
      'pgEnum("program_occurrence_status", ["scheduled", "cancelled"])',
    );
    expect(schemaSource).toContain('registrationOpensAt: timestamp("registration_opens_at"');
    expect(schemaSource).toContain('registrationClosesAt: timestamp("registration_closes_at"');
    expect(schemaSource).toContain('sortOrder: integer("sort_order")');
    expect(schemaSource).toContain('meetUrl: text("meet_url")');
  });

  it("lets bookings and holds target exactly one scheduling shape", () => {
    expect(
      schemaSource.match(/scheduledProgramId: uuid\("scheduled_program_id"\)/g) ?? [],
    ).toHaveLength(3);
    expect(schemaSource).toContain("bookings_valid_scheduling_target");
    expect(schemaSource).toContain("booking_slot_holds_valid_scheduling_target");
    expect(schemaSource).toContain(
      'slotStartAt: timestamp("slot_start_at", { withTimezone: true }),',
    );
    expect(schemaSource).toContain(
      'slotEndAt: timestamp("slot_end_at", { withTimezone: true }),',
    );
  });
});
