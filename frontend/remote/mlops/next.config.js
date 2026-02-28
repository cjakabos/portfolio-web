// host/next.config.js
const { NextFederationPlugin } = require("@module-federation/nextjs-mf");

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    images: {
        qualities: [25, 50, 75, 100],
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    output: 'standalone',
    webpack(config, options) {
    const { isServer } = options;
    const remoteDir = isServer ? "ssr" : "chunks";
    config.experiments = { topLevelAwait: true, layers: true };

    config.plugins.push(
        new NextFederationPlugin({
          name: "mlops",
          filename: `static/${remoteDir}/remoteEntry.js`,
          exposes: {
            "./mlops": "./pages/index",
          },
          shared: {
            "@tailwindcss/postcss": {
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
