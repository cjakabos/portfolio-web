// host/next.config.js
//
// ===========================================================================
// FIX: Module Federation remote URLs are now configurable via
// NEXT_PUBLIC_REMOTE_* environment variables. This makes the shell operable
// outside local development (staging, production, other developers' machines).
//
// Environment variables (with localhost defaults for local dev):
//   NEXT_PUBLIC_REMOTE_OPENMAPS_URL  (default: http://localhost:5002)
//   NEXT_PUBLIC_REMOTE_JIRA_URL      (default: http://localhost:5003)
//   NEXT_PUBLIC_REMOTE_CHATLLM_URL   (default: http://localhost:5333)
//   NEXT_PUBLIC_REMOTE_MLOPS_URL     (default: http://localhost:5005)
//   NEXT_PUBLIC_REMOTE_PETSTORE_URL  (default: http://localhost:5006)
//
// These are baked in at build time (Next.js replaces NEXT_PUBLIC_* during
// the build). Set them in docker-compose build args or .env files per
// environment.
// ===========================================================================

const { NextFederationPlugin } = require("@module-federation/nextjs-mf");

// Remote base URLs — configurable per environment, default to localhost for local dev
const REMOTE_OPENMAPS = process.env.NEXT_PUBLIC_REMOTE_OPENMAPS_URL || "http://localhost:5002";
const REMOTE_JIRA     = process.env.NEXT_PUBLIC_REMOTE_JIRA_URL     || "http://localhost:5003";
const REMOTE_CHATLLM  = process.env.NEXT_PUBLIC_REMOTE_CHATLLM_URL  || "http://localhost:5333";
const REMOTE_MLOPS    = process.env.NEXT_PUBLIC_REMOTE_MLOPS_URL    || "http://localhost:5005";
const REMOTE_PETSTORE = process.env.NEXT_PUBLIC_REMOTE_PETSTORE_URL || "http://localhost:5006";

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
              remote:  `openmaps@${REMOTE_OPENMAPS}/_next/static/${remoteDir}/remoteEntry.js`,
              remote2: `jira@${REMOTE_JIRA}/_next/static/${remoteDir}/remoteEntry.js`,
              remote3: `chatllm@${REMOTE_CHATLLM}/_next/static/${remoteDir}/remoteEntry.js`,
              remote4: `mlops@${REMOTE_MLOPS}/_next/static/${remoteDir}/remoteEntry.js`,
              remote5: `petstore@${REMOTE_PETSTORE}/_next/static/${remoteDir}/remoteEntry.js`,
            },
        }),
    );

    return config;
  },
};

module.exports = nextConfig;
