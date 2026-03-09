import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    luma: {
      stale: 30,       // client router cache: 30s
      revalidate: 120, // background refresh every 2 min
      expire: 3600,    // force-fresh after 1h of no requests
    },
  },
};

export default nextConfig;
