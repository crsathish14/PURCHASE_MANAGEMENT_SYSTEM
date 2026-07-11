import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The root layout lives at app/[lang]/layout.tsx (a top-level dynamic
    // segment), so a plain app/not-found.tsx can't catch genuinely
    // unmatched URLs (e.g. a typo'd path) — only explicit notFound() calls
    // within a resolved /en/... segment. global-not-found.tsx handles the
    // "no route matched at all" case. See
    // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md
    globalNotFound: true,
  },
};

export default nextConfig;
