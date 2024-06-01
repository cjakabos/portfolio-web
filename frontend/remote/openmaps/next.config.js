const { NextFederationPlugin } = require("@module-federation/nextjs-mf");

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["react-leaflet", "react-leaflet-cluster"],
    experimental: {
        esmExternals: "loose",
    },
    reactStrictMode: false,
    eslint: {
        ignoreDuringBuilds: true,
    },
    output: 'standalone',
    webpack(config, options) {
      const { isServer } = options;
      const remoteDir = isServer ? "ssr" : "chunks";

      config.plugins.push(
        new NextFederationPlugin({
          name: "remote",
          filename: `static/${remoteDir}/remoteEntry.js`,
          exposes: {
            "./openmaps": "./components/OpenMaps/OpenMaps",
          },
          shared: {
            tailwindcss: {
              eager: true,
              singleton: true,
              requiredVersion: false,
            },
          },
        }),
      );

      return config;
    },
};

module.exports = nextConfig;
