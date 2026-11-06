import type { NextConfig } from "next";

// WEB_TEST=1: only the static Saudi grid site (src/app/**/*.web.tsx) into out/, for a static host.
const webTest = process.env.WEB_TEST === "1";

const nextConfig: NextConfig = {
  ...(webTest && { output: "export" as const, pageExtensions: ["web.tsx"], trailingSlash: true }),
  // Pin the workspace root to this project so Next doesn't pick up an unrelated
  // lockfile from a parent directory.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
