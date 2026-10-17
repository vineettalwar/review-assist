import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const isProd = process.env.NODE_ENV === "production";

// No script-src here on purpose: Next's inline bootstrap scripts and GSAP would need nonces/hashes.
const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

// Review links carry the token in the URL and customers navigate on to Google, Trustpilot, etc.
const reviewHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  // A second dev server (e.g. the editor preview) sets NEXT_DIST_DIR so it never shares .next with yours.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    // Later entries win for duplicate keys, so the /r overrides come after the catch-all.
    return [
      { source: "/:path*", headers: baseHeaders },
      { source: "/r/:path*", headers: reviewHeaders },
      { source: "/api/r/:path*", headers: reviewHeaders },
    ];
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
