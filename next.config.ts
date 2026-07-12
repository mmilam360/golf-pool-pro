import type { NextConfig } from "next";

const VERSIONED_WORDMARK_PATH = "/brand/golf-pools-pro-wordmark.d3f016dcc364.webp";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: VERSIONED_WORDMARK_PATH,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
