import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "http://app:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${backend}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
