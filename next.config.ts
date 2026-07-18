import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/api/*": [
      "./next.config.ts",
      "./README.md",
      "./AGENTS.md",
      "./scripts/**/*",
      "./supabase/**/*",
      "./local-data/**/*",
      "./Private_Data/**/*",
      "./material_center/**/*",
      "./.logs/**/*",
      "./src/**/*.test.ts",
    ],
  },
};

export default nextConfig;
