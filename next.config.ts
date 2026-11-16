import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local e2e runs use 127.0.0.1 and cloud previews proxy through *.e2b.app; without this,
  // Next 16 blocks dev-only resources (HMR) for those origins and the client never hydrates.
  allowedDevOrigins: ["127.0.0.1", "*.e2b.app"],
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],
  async headers() {
    const noStore = [
      { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
      { key: 'CDN-Cache-Control', value: 'no-store' },
      { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
    ];
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'same-origin' },
      ] },
      ...['/api/events/:path*', '/api/guests/:path*', '/api/bookings/:path*', '/event/:path*', '/secure-account/:path*', '/dashboard/:path*'].map(source => ({ source, headers: noStore })),
    ];
  },
};

export default nextConfig;
