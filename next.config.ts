import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Structure + Syllabus were merged into /program.
  async redirects() {
    return [
      { source: "/structure", destination: "/program", permanent: true },
      { source: "/syllabus", destination: "/program#route", permanent: true },
      // The Calendly one-on-one was replaced by the Personalised One-on-One batch.
      { source: "/courses/one-on-one", destination: "/courses/personalised-one-on-one", permanent: true },
    ];
  },
};

export default nextConfig;
