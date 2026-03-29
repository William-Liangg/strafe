import type { NextConfig } from "next";

const backendBaseUrl =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendBaseUrl.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

export default nextConfig;
