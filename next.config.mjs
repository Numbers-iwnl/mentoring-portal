/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Padrão é 1mb; planilhas de clínicas com vários meses preenchidos podem passar disso.
      bodySizeLimit: "15mb"
    }
  }
};

export default nextConfig;
