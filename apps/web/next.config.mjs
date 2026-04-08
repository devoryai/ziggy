import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@ziggy/shared",
    "@ziggy/policy",
    "@ziggy/orchestrator",
    "@ziggy/memory",
    "@ziggy/models",
    "@ziggy/tools",
  ],

  env: {
    ZIGGY_DB_PATH: process.env.ZIGGY_DB_PATH ?? resolve(REPO_ROOT, "data/ziggy.db"),
    ZIGGY_POLICY_DIR: process.env.ZIGGY_POLICY_DIR ?? resolve(REPO_ROOT, "policy"),
    ZIGGY_ARTIFACTS_DIR: process.env.ZIGGY_ARTIFACTS_DIR ?? resolve(REPO_ROOT, "data/runs"),
  },

  experimental: {
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
