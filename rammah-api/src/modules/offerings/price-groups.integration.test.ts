import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  auditLogs,
  offeringPriceCountries,
  offeringPrices,
  offerings,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import {
  archiveAdminOfferingPriceById,
  createAdminOfferingPrice,
  getAdminOfferingPriceMetadata,
  listAdminOfferingPrices,
  updateAdminOfferingPriceById,
} from "./admin-offerings.service.js";

const seedOffering = async () => {
  const [offering] = await getTestDatabase().db
    .insert(offerings)
    .values({
      title: "Country pricing test",
      slug: `country-pricing-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "paid",
      schedulingMode: "appointment",
      durationMinutes: 60,
      requiresPayment: true,
      status: "published",
    })
    .returning();
  return offering!;
};

const groupInput = (overrides: Record<string, unknown> = {}) => ({
  name: "GCC",
  countryCodes: ["SA", "AE", "KW"],
  currency: "EGP",
  baseAmountMinor: 15_000,
  earlyBirdAmountMinor: 12_000,
  earlyBirdEndsAt: "2030-09-01T20:59:59.000Z",
  status: "published" as const,
  ...overrides,
});

describe.sequential("admin offering price groups", () => {
  it("creates and lists one-or-many country groups with canonical metadata", async () => {
    const offering = await seedOffering();
    const created = await createAdminOfferingPrice(offering.id, groupInput(), {
      ipAddress: "127.0.0.1",
    });

    expect(created).toMatchObject({
      name: "GCC",
      countryCodes: ["AE", "KW", "SA"],
      currency: "EGP",
      baseAmountMinor: 15_000,
      status: "published",
    });
    await expect(listAdminOfferingPrices(offering.id)).resolves.toEqual([created]);

    const metadata = getAdminOfferingPriceMetadata();
    expect(metadata.supportedCurrencies).toContain("EGP");
    expect(metadata.countries).toEqual(
      expect.arrayContaining([
        { code: "EG", name: "Egypt" },
        { code: "SA", name: "Saudi Arabia" },
      ]),
    );
    expect(metadata.countries.map(({ name }) => name)).toEqual(
      [...metadata.countries.map(({ name }) => name)].sort((a, b) => a.localeCompare(b)),
    );
  });

  it("accepts legacy one-country input for one release", async () => {
    const offering = await seedOffering();

    await expect(
      createAdminOfferingPrice(offering.id, {
        countryCode: "eg",
        currency: "egp",
        baseAmountMinor: 10_000,
        status: "draft",
      }),
    ).resolves.toMatchObject({
      name: "Egypt",
      countryCodes: ["EG"],
      currency: "EGP",
    });
  });

  it("reports overlaps and leaves country replacement atomic", async () => {
    const offering = await seedOffering();
    const first = await createAdminOfferingPrice(
      offering.id,
      groupInput({ name: "Egypt", countryCodes: ["EG"] }),
    );
    const second = await createAdminOfferingPrice(
      offering.id,
      groupInput({ name: "Saudi", countryCodes: ["SA"] }),
    );

    await expect(
      updateAdminOfferingPriceById(
        offering.id,
        first.id,
        groupInput({ name: "Mixed", countryCodes: ["AE", "SA"] }),
      ),
    ).rejects.toMatchObject({
      code: "PRICE_COUNTRY_CONFLICT",
      statusCode: 409,
      meta: {
        conflicts: [{ countryCode: "SA", priceId: second.id, groupName: "Saudi" }],
      },
    });

    await expect(listAdminOfferingPrices(offering.id)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, countryCodes: ["EG"], name: "Egypt" }),
        expect.objectContaining({ id: second.id, countryCodes: ["SA"], name: "Saudi" }),
      ]),
    );
  });

  it("replaces memberships atomically and can reactivate its own country history", async () => {
    const offering = await seedOffering();
    const group = await createAdminOfferingPrice(
      offering.id,
      groupInput({ name: "Initial", countryCodes: ["EG", "AE"] }),
    );

    await expect(
      updateAdminOfferingPriceById(offering.id, group.id, {
        name: "Updated",
        countryCodes: ["SA", "AE"],
        baseAmountMinor: 20_000,
      }),
    ).resolves.toMatchObject({
      name: "Updated",
      countryCodes: ["AE", "SA"],
      baseAmountMinor: 20_000,
    });
    await expect(
      updateAdminOfferingPriceById(offering.id, group.id, { countryCodes: ["EG"] }),
    ).resolves.toMatchObject({ countryCodes: ["EG"] });

    const memberships = await getTestDatabase().db
      .select()
      .from(offeringPriceCountries)
      .where(eq(offeringPriceCountries.priceId, group.id));
    expect(memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ countryCode: "EG", active: true }),
        expect.objectContaining({ countryCode: "AE", active: false }),
        expect.objectContaining({ countryCode: "SA", active: false }),
      ]),
    );
  });

  it("maps a concurrent unique-index race to one stable conflict", async () => {
    const offering = await seedOffering();
    const results = await Promise.allSettled([
      createAdminOfferingPrice(
        offering.id,
        groupInput({ name: "Egypt A", countryCodes: ["EG"] }),
      ),
      createAdminOfferingPrice(
        offering.id,
        groupInput({ name: "Egypt B", countryCodes: ["EG"] }),
      ),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "PRICE_COUNTRY_CONFLICT", statusCode: 409 },
    });
    const activeMemberships = await getTestDatabase().db
      .select()
      .from(offeringPriceCountries)
      .where(
        and(
          eq(offeringPriceCountries.offeringId, offering.id),
          eq(offeringPriceCountries.countryCode, "EG"),
          eq(offeringPriceCountries.active, true),
        ),
      );
    expect(activeMemberships).toHaveLength(1);
  });

  it("archives terminally, releases countries, and preserves inactive history", async () => {
    const offering = await seedOffering();
    const original = await createAdminOfferingPrice(
      offering.id,
      groupInput({ name: "Egypt old", countryCodes: ["EG"] }),
    );

    await archiveAdminOfferingPriceById(offering.id, original.id);
    await expect(
      updateAdminOfferingPriceById(offering.id, original.id, { name: "Cannot reopen" }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
    await expect(
      archiveAdminOfferingPriceById(offering.id, original.id),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });

    await expect(
      createAdminOfferingPrice(
        offering.id,
        groupInput({ name: "Egypt new", countryCodes: ["EG"] }),
      ),
    ).resolves.toMatchObject({ countryCodes: ["EG"], status: "published" });

    const history = await getTestDatabase().db
      .select()
      .from(offeringPriceCountries)
      .where(eq(offeringPriceCountries.priceId, original.id));
    expect(history).toEqual([expect.objectContaining({ countryCode: "EG", active: false })]);
  });

  it("rolls the group and memberships back when its audit insert fails", async () => {
    const offering = await seedOffering();
    const missingAdminId = "00000000-0000-4000-8000-000000000001";

    await expect(
      createAdminOfferingPrice(offering.id, groupInput({ countryCodes: ["EG"] }), {
        adminUserId: missingAdminId,
      }),
    ).rejects.toThrow();

    const [groups, memberships, logs] = await Promise.all([
      getTestDatabase().db
        .select()
        .from(offeringPrices)
        .where(eq(offeringPrices.offeringId, offering.id)),
      getTestDatabase().db
        .select()
        .from(offeringPriceCountries)
        .where(eq(offeringPriceCountries.offeringId, offering.id)),
      getTestDatabase().db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.resourceType, "offering_price"),
            eq(auditLogs.adminUserId, missingAdminId),
          ),
        ),
    ]);
    expect(groups).toHaveLength(0);
    expect(memberships).toHaveLength(0);
    expect(logs).toHaveLength(0);
  });

  it("also rolls updates and archives back when their audit insert fails", async () => {
    const offering = await seedOffering();
    const group = await createAdminOfferingPrice(
      offering.id,
      groupInput({ name: "Original", countryCodes: ["EG"] }),
    );
    const invalidAuditContext = {
      adminUserId: "00000000-0000-4000-8000-000000000001",
    };

    await expect(
      updateAdminOfferingPriceById(
        offering.id,
        group.id,
        { name: "Must roll back", countryCodes: ["SA"] },
        invalidAuditContext,
      ),
    ).rejects.toThrow();
    await expect(listAdminOfferingPrices(offering.id)).resolves.toEqual([
      expect.objectContaining({
        id: group.id,
        name: "Original",
        countryCodes: ["EG"],
        status: "published",
      }),
    ]);

    await expect(
      archiveAdminOfferingPriceById(offering.id, group.id, invalidAuditContext),
    ).rejects.toThrow();
    await expect(listAdminOfferingPrices(offering.id)).resolves.toEqual([
      expect.objectContaining({
        id: group.id,
        countryCodes: ["EG"],
        status: "published",
      }),
    ]);
  });
});
