import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@zhidu/ui", "@zhidu/shared", "@zhidu/db", "@zhidu/ai"],
};

export default nextConfig;
