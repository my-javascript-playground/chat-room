/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the Docker multi-stage build — produces a minimal self-contained
  // server in .next/standalone that doesn't need the full node_modules at runtime.
  output: "standalone",
};

module.exports = nextConfig;
