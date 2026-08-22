import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const isDevCommand = process.argv.includes("dev");

function lanDevOrigins() {
  const fromEnv = (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const fromNics = Object.values(networkInterfaces())
    .flat()
    .flatMap((nic) => (nic && nic.family === "IPv4" && !nic.internal ? [nic.address] : []));
  return [...new Set([...fromNics, ...fromEnv])];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: lanDevOrigins(),
  ...(isDevCommand
    ? { distDir: process.env.NEXT_DIST_DIR || ".next-webpack" }
    : process.env.NEXT_DIST_DIR
      ? { distDir: process.env.NEXT_DIST_DIR }
      : {}),
  serverExternalPackages: ["@base-org/account"],
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/evm": false,
      "@x402/evm/upto/client": false,
      "@x402/evm/exact/client": false,
      "@x402/core/client": false,
      "@x402/svm/exact/client": false,
    };
    return config;
  },
  async redirects() {
    return [
      { source: "/live", destination: "/watch", permanent: false },
      { source: "/opening", destination: "/open", permanent: false },
      { source: "/invite", destination: "/open?from=invite", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/certificate/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/watch/stream",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/watch/stream/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
