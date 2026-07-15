import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Client-side Router Cache. `dynamic` defaults to 0 (every back/forward
    // navigation refetches the page from the server — a full round-trip to the
    // DB in eu-west-1). Caching dynamic segments for 30s makes revisiting a page
    // instant. Server Actions still auto-refresh the route they mutate, so this
    // doesn't serve stale data after a write — it only speeds up plain navigation.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
