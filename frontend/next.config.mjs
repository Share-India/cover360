/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server build used by the Docker image
  output: 'standalone',
  devIndicators: false,
  // Allow opening the dev server from a phone on the local network
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
