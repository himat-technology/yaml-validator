import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// connect-src 'self' means the browser itself refuses to send data to any
// other origin, backing up the "nothing leaves your browser" guarantee.
// Development skips the CSP because hot reloading needs eval and websockets.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/", destination: "/free-tools/yaml-validator", permanent: false }];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
    ];
    if (isProduction) {
      securityHeaders.push({ key: "Content-Security-Policy", value: contentSecurityPolicy });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
