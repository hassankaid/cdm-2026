import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixe la racine du projet (un package-lock.json traîne dans le dossier parent)
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
