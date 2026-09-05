import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "www.paypalobjects.com",
        pathname: "/webstatic/**",
      },
      {
        protocol: "https",
        hostname: "randomuser.me",
        pathname: "/api/portraits/**",
      },
    ],
  },
  async rewrites() {
    return [
      // Clinic seat tokens stay at /invite/<64-hex> for existing emails.
      // Rewrite keeps Stripe/Resend/admin off the specialty-invite page graph
      // so they cannot leak into the Edge middleware bundle.
      {
        source:
          "/:locale(en|de|tr|fr|it|es|pt|zh|ja)/invite/:token([a-fA-F0-9]{64})",
        destination: "/:locale/invite/accept/:token",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Upload source maps for readable error stack traces
  org: "socialmediapm",
  project: "mydoctors360",

  // Only print logs during CI builds
  silent: !process.env.CI,

  // Route browser requests through a Next.js rewrite to avoid ad blockers
  tunnelRoute: "/monitoring",

  // Source maps: upload to Sentry but don't expose to users
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
