import type { NextConfig } from "next";

const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  experimental: {
    // Two root layouts ((en) and ru): a single branded 404 for unknown URLs.
    globalNotFound: true,
  },
};

export default config;
