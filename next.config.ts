import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tambahkan konfigurasi eslint di sini
  eslint: {
    // Opsi ini akan membuat build tetap berjalan (sukses)
    // meskipun ada error dari ESLint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
