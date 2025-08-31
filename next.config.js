/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... your other config options

  typescript: {
    // This successfully ignores TypeScript errors.
    ignoreBuildErrors: true,
  },

  eslint: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has ESLint errors.
    // !! WARN !!
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
