/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // plain static files in /out, which is all the Firebase Spark plan can host
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
