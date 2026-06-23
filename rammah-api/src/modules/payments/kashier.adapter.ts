import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";

const checkoutBaseUrl = "https://checkout.kashier.io";
const scriptUrl = `${checkoutBaseUrl}/kashier-checkout.js`;
const apiBaseUrls = {
  test: "https://test-api.kashier.io",
  live: "https://api.kashier.io",
} as const;

export type KashierSessionInput = {
  merchantOrderId: string;
  amountMinor: number;
  currency: string;
  publicToken: string;
};

export type KashierSession = {
  provider: "kashier";
  mode: "test" | "live";
  merchantId: string;
  merchantOrderId: string;
  amount: string;
  currency: string;
  hash: string;
  allowedMethods: string;
  merchantRedirect: string;
  scriptUrl: string;
  checkoutUrl: string;
};

export type KashierPaymentReconciliation = {
  provider: "kashier";
  merchantOrderId: string;
  providerOrderId: string | null;
  status: string | null;
  amountMinor: number | null;
  currency: string | null;
  raw: Record<string, unknown>;
};

const getKashierSigningKey = () => env.KASHIER_API_KEY || env.KASHIER_SECRET;
const getKashierAuthorizationKey = () => env.KASHIER_SECRET || env.KASHIER_API_KEY;

export const assertKashierConfigured = () => {
  if (
    !env.KASHIER_MERCHANT_ID ||
    !env.KASHIER_API_KEY ||
    !env.KASHIER_CALLBACK_URL ||
    !env.KASHIER_RETURN_URL
  ) {
    throw new AppError({
      code: "PROVIDER_ERROR",
      message: "Kashier payment configuration is incomplete.",
      statusCode: httpStatus.internalServerError,
      expose: false,
    });
  }
};

const formatAmount = (amountMinor: number) => {
  const amount = amountMinor / 100;
  return amount.toFixed(2);
};

const buildReturnUrl = (publicToken: string) => {
  const callbackUrl = new URL(env.KASHIER_CALLBACK_URL ?? "");
  callbackUrl.searchParams.set("booking", publicToken);
  return callbackUrl.toString();
};

export const createKashierOrderHash = (input: {
  merchantId: string;
  merchantOrderId: string;
  amount: string;
  currency: string;
  secret: string;
}) => {
  const path = `/?payment=${input.merchantId}.${input.merchantOrderId}.${input.amount}.${input.currency}`;
  return crypto.createHmac("sha256", input.secret).update(path).digest("hex");
};

export const createKashierSession = (input: KashierSessionInput): KashierSession => {
  assertKashierConfigured();

  const merchantId = env.KASHIER_MERCHANT_ID as string;
  const secret = getKashierSigningKey() as string;
  const amount = formatAmount(input.amountMinor);
  const currency = input.currency.toUpperCase();
  const merchantRedirect = buildReturnUrl(input.publicToken);
  const hash = createKashierOrderHash({
    merchantId,
    merchantOrderId: input.merchantOrderId,
    amount,
    currency,
    secret,
  });
  const params = new URLSearchParams({
    merchantId,
    orderId: input.merchantOrderId,
    mode: env.PAYMENT_MODE,
    amount,
    currency,
    hash,
    merchantRedirect,
    allowedMethods: env.KASHIER_ALLOWED_METHODS,
    display: "en",
  });

  return {
    provider: "kashier",
    mode: env.PAYMENT_MODE,
    merchantId,
    merchantOrderId: input.merchantOrderId,
    amount,
    currency,
    hash,
    allowedMethods: env.KASHIER_ALLOWED_METHODS,
    merchantRedirect,
    scriptUrl,
    checkoutUrl: `${checkoutBaseUrl}?${params.toString()}`,
  };
};

const signatureExcludedKeys = new Set(["signature", "mode"]);

const buildSignaturePayload = (params: URLSearchParams, sort: boolean) => {
  const entries = Array.from(params.entries()).filter(
    ([key]) => !signatureExcludedKeys.has(key),
  );
  const orderedEntries = sort ? entries.sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) : entries;

  return orderedEntries.map(([key, value]) => `${key}=${value}`).join("&");
};

const buildOfficialCallbackSignaturePayload = (params: URLSearchParams) => {
  const orderedKeys = [
    "paymentStatus",
    "cardDataToken",
    "maskedCard",
    "merchantOrderId",
    "orderId",
    "cardBrand",
    "orderReference",
    "transactionId",
    "amount",
    "currency",
  ];

  return orderedKeys.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");
};

export const verifyKashierCallbackSignature = (rawQuery: string) => {
  const secret = getKashierSigningKey();

  if (!secret) return false;

  const params = new URLSearchParams(rawQuery);
  const signature = params.get("signature");

  if (!signature) return false;

  const candidates = [
    buildOfficialCallbackSignaturePayload(params),
    buildSignaturePayload(params, false),
    buildSignaturePayload(params, true),
  ];

  return candidates.some((payload) => {
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);

    return (
      expectedBuffer.length === signatureBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    );
  });
};

const parseReconciliationAmountMinor = (value: unknown) => {
  if (typeof value !== "number" && typeof value !== "string") return null;

  const amount = Number(value);

  if (!Number.isFinite(amount)) return null;

  return Math.round(amount * 100);
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const reconcileKashierPayment = async (
  merchantOrderId: string,
): Promise<KashierPaymentReconciliation> => {
  assertKashierConfigured();

  const authorizationKey = getKashierAuthorizationKey();

  if (!authorizationKey) {
    throw new AppError({
      code: "PROVIDER_ERROR",
      message: "Kashier reconciliation configuration is incomplete.",
      statusCode: httpStatus.internalServerError,
      expose: false,
    });
  }

  const response = await fetch(
    `${apiBaseUrls[env.PAYMENT_MODE]}/payments/orders/${encodeURIComponent(merchantOrderId)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: authorizationKey,
      },
    },
  );
  const payload = asRecord(await response.json().catch(() => ({})));

  if (!response.ok) {
    throw new AppError({
      code: "PROVIDER_ERROR",
      message: "Kashier payment reconciliation failed.",
      statusCode: httpStatus.badGateway,
      expose: false,
    });
  }

  const reconciliation = asRecord(payload.response ?? payload);
  const order = asRecord(reconciliation.order);
  const providerOrderId =
    typeof reconciliation.orderId === "string" ? reconciliation.orderId : null;
  const status = typeof reconciliation.status === "string" ? reconciliation.status : null;
  const currency = typeof order.currency === "string" ? order.currency.toUpperCase() : null;
  const amountMinor = parseReconciliationAmountMinor(
    order.amount ?? reconciliation.totalCapturedAmount ?? reconciliation.totalAuthorizedAmount,
  );

  return {
    provider: "kashier",
    merchantOrderId,
    providerOrderId,
    status,
    amountMinor,
    currency,
    raw: reconciliation,
  };
};
