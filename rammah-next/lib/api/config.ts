const fallbackApiBaseUrl = "http://localhost:4000/api/v1";

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? fallbackApiBaseUrl;
