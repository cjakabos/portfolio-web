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
    transpilePackages: ['@mui/x-data-grid'],
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
              remote: `openmaps@http://localhost:5002/_next/static/${remoteDir}/remoteEntry.js`,
              remote2: `jira@http://localhost:5003/_next/static/${remoteDir}/remoteEntry.js`,
              remote3: `chatllm@http://localhost:5333/_next/static/${remoteDir}/remoteEntry.js`,
              remote4: `mlops@http://localhost:5005/_next/static/${remoteDir}/remoteEntry.js`,
              remote5: `petstore@http://localhost:5006/_next/static/${remoteDir}/remoteEntry.js`,
            },
        }),
    );

    return config;
  },
};

module.exports = nextConfig;
