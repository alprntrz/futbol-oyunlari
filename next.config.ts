import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Next doesn't pick up an unrelated
  // lockfile from a parent directory.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
