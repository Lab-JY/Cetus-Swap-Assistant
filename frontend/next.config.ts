import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // In Next.js 15+, turbopack options are top-level, not under experimental
  // However, Next.js 16 types might still be evolving or strict
  // We'll try ignoring the type check for now if it's not in the type definition yet
  // or just revert the config change if it causes build error.
  // Actually, let's just remove the experimental block for now to fix the build
  // as the warning is non-blocking but the type error is blocking.
};

export default nextConfig;
