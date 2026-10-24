import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["kafkajs"],
  poweredByHeader: false,
};

export default nextConfig;
