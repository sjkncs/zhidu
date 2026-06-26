import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@zhidu/ui", "@zhidu/shared", "@zhidu/db", "@zhidu/ai"],
  typescript: {
    // TS 5.9.3 tsc --noEmit crashes with "Debug Failure" — known tool bug,
    // Turbopack compilation itself succeeds. Re-enable after TS fix.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
