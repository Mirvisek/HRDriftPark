import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@react-pdf/renderer'],
  experimental: {
    serverActions: {
      allowedOrigins: [
        'hrdriftpark.pl',
        'www.hrdriftpark.pl',
        'localhost:3000',
        '127.0.0.1:3000',
      ],
    },
  },
};

export default nextConfig;
