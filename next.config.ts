import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The landing page took over "/"; the app now lives under /dashboard.
  redirects() {
    return [
      { source: "/landing", destination: "/", permanent: false },
      { source: "/projects/:id", destination: "/dashboard/projects/:id", permanent: false },
    ];
  },
};

export default nextConfig;
