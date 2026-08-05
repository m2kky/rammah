import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findPublishedOfferingById,
  findPublishedOfferingBySlug,
  findPublishedLocationsForOffering,
  findPublishedOfferings,
  findPublishedPricesByOfferingIds,
  findPublicOfferingSchedulingSources,
} from "./offerings.repository.js";
import { toPublicOffering } from "./offerings.mapper.js";
import { listPublicBookingFormFields } from "../booking-form-fields/booking-form-fields.service.js";

export const listPublicOfferings = async () => {
  const offerings = await findPublishedOfferings();
  const prices = await findPublishedPricesByOfferingIds(offerings.map((offering) => offering.id));

  return offerings.map((offering) =>
    toPublicOffering(
      offering,
      prices.filter((price) => price.offeringId === offering.id),
    ),
  );
};

export const getPublicOfferingBySlug = async (slug: string) => {
  const offering = await findPublishedOfferingBySlug(slug);

  if (!offering) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const prices = await findPublishedPricesByOfferingIds([offering.id]);

  return toPublicOffering(offering, prices);
};

export const getPublicOfferingBookingConfig = async (offeringId: string) => {
  const offering = await findPublishedOfferingById(offeringId);

  if (!offering) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const [prices, fields, locations, schedulingSources] = await Promise.all([
    findPublishedPricesByOfferingIds([offering.id]),
    listPublicBookingFormFields(offering.id),
    findPublishedLocationsForOffering(offering.id),
    findPublicOfferingSchedulingSources(offering.id),
  ]);
  const schedulingMode = schedulingSources.hasPublishedAvailability
    ? "appointment"
    : schedulingSources.hasPublishedSessions
      ? "scheduled_program"
      : "appointment";
  const schedulingTimezone =
    schedulingMode === "appointment"
      ? schedulingSources.availabilityTimezone ?? "Africa/Cairo"
      : schedulingSources.sessionTimezone ?? "Africa/Cairo";

  return {
    offering: {
      ...toPublicOffering(offering, prices),
      schedulingMode,
      schedulingTimezone,
    },
    fields,
    locations,
  };
};
