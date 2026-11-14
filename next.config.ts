import type { NextConfig } from "next";

const configuration: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["pdfkit"],
  ...(process.env.GLIMPSEA_DALANG_BUILD === "1" && {
    output: "standalone",
    experimental: { cpus: 1 },
  }),
};
export default configuration;
