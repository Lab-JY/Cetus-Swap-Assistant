import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpack = require("webpack");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve ??= {};
      config.resolve.fallback ??= {};
      config.resolve.fallback.buffer = require.resolve("buffer/");

      config.plugins ??= [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
    }

    return config;
  },
};

export default nextConfig;
