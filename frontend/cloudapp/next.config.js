// host/next.config.js
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
    config.experiments = { topLevelAwait: true, layers: true };

    config.plugins.push(
        new NextFederationPlugin({
            name: "host",
            filename: `static/${remoteDir}/remoteEntry.js`,
            extraOptions: {},
            remotes: {
              remote: `remote@http://localhost:5002/_next/static/${remoteDir}/remoteEntry.js`,
            },
            shared: {},
        }),
    );

    return config;
  },
};

module.exports = nextConfig;
