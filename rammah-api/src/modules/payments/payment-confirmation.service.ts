import {
  finalizeVerifiedPaymentEvent,
  type TrustedPaymentFinalizationInput,
} from "./public-payments.repository.js";

export const applyTrustedPaymentResult = (input: TrustedPaymentFinalizationInput) =>
  finalizeVerifiedPaymentEvent(input);
