import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  transpilePackages: ["@dineflow/shared"],
  reactStrictMode: true
};
export default nextConfig;
