/** Static export: the build output (out/) is copied into ../site by the GitHub workflow. */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  poweredByHeader: false,
};
export default nextConfig;
