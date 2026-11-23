import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El SDK de Ovenbird se publica como ESM con componentes "use client" (docs/02).
  transpilePackages: ["@ovenbird/react"],
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
