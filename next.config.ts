import type { NextConfig } from "next";

const apiOrigin = (() => {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return "http://localhost:4000";
  }
})();
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https://checkout.kashier.io"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.kashier.io";

const nextConfig: NextConfig = {
  async headers() {
    const paymentSecurityHeaders = [
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          scriptSrc,
          "frame-src https://checkout.kashier.io",
          `connect-src 'self' ${apiOrigin} https://checkout.kashier.io`,
          "img-src 'self' data: https:",
          "style-src 'self' 'unsafe-inline'",
          "base-uri 'self'",
          "form-action 'self' https://checkout.kashier.io",
          "frame-ancestors 'self'",
        ].join("; "),
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
    ];

    return [
      {
        source: "/booking/payment/:path*",
        headers: paymentSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
