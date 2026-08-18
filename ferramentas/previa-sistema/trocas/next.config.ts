import type { NextConfig } from 'next';

// Build da PREVIA estatica (nao e o build do produto). Exporta HTML puro para
// o GitHub Pages, sob o subcaminho do repositorio de previas.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/Previa-Clientes/sistema-harmonelle',
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
