/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDF pipeline (Phase 1) runs in route handlers; keep server actions lean.
  experimental: {},
};

export default nextConfig;
