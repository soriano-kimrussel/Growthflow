import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every app page reads the session cookie, so pages are request-time
  // rendered; Cache Components would add Suspense boundaries for no gain here.
  cacheComponents: false,
  // Native / Node-only database drivers stay out of the bundle.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "pg", "@prisma/adapter-pg"],
  // A browser extension polls this path on localhost. It isn't an app route,
  // so keep the 404s out of the dev log.
  logging: { incomingRequests: { ignore: [/^\/api\/ext\/token/] } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
