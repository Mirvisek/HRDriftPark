import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js still needs inline/eval in many setups; keep scoped to scripts only.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: ['@react-pdf/renderer', 'exceljs'],
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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          ...(isProd
            ? [{
                key: 'Strict-Transport-Security',
                value: 'max-age=63072000; includeSubDomains; preload',
              }]
            : []),
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ],
      },
      {
        // Uploaded files should not execute as documents with scripts
        source: '/uploads/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Disposition', value: 'inline' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; sandbox",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
