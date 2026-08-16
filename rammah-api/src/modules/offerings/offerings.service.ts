import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findPublishedOfferingById,
  findPublishedOfferingBySlug,
  findPublishedLocationsForOffering,
  findPublishedOfferings,
  findPublicBookingTimezone,
} from "./offerings.repository.js";
import { toPublicOffering } from "./offerings.mapper.js";
import { listPublicBookingFormFields } from "../booking-form-fields/booking-form-fields.service.js";

export const listPublicOfferings = async () => {
  const offerings = await findPublishedOfferings();
  return offerings.map(toPublicOffering);
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

  return toPublicOffering(offering);
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

  const [fields, locations, schedulingTimezone] = await Promise.all([
    listPublicBookingFormFields(offering.id),
    findPublishedLocationsForOffering(offering.id),
    findPublicBookingTimezone(),
  ]);

  return {
    offering: {
      ...toPublicOffering(offering),
      schedulingMode: offering.schedulingMode,
      schedulingTimezone,
    },
    fields,
    locations,
  };
};
