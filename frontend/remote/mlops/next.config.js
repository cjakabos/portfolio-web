const { NextFederationPlugin } = require("@module-federation/nextjs-mf");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
          name: "mlops",
          filename: `static/${remoteDir}/remoteEntry.js`,
          exposes: {
            "./mlops": "./pages/index",
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
