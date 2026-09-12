import type { NextConfig } from "next";

// Opening the dev server on a phone means asking for it by LAN or mesh address
// rather than localhost, and Next turns those away unless they are named here.
// Set FIELD_BENCH_DEV_ORIGINS to add your own, comma separated.
const devOrigins = [
  "127.0.0.1",
  "localhost",
  "10.*.*.*",
  "192.168.*.*",
  "172.16.*.*",
  "172.17.*.*",
  "172.18.*.*",
  "172.19.*.*",
  "172.2*.*.*",
  "172.3*.*.*",
  "100.*.*.*",
  "*.netbird.selfhosted",
  ...(process.env.FIELD_BENCH_DEV_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
};

export default nextConfig;
