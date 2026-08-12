/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't advertise the framework/version to every visitor.
  poweredByHeader: false,
  compress: true,
  experimental: {
    // Tree-shake barrel imports from these packages instead of pulling the
    // whole module graph into each client chunk.
    optimizePackageImports: ["@reduxjs/toolkit", "react-redux", "qrcode"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            // The voice/camera room needs these on our own origin. An empty
            // list ()  means "no origin may use it", which makes the browser
            // reject getUserMedia without ever showing a permission prompt.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
