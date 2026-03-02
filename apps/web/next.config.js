const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "3001" },
      { protocol: "https", hostname: "womanday.nhatquy.com" },
      { protocol: "http", hostname: "womanday.nhatquy.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
