const { NextFederationPlugin } = require("@module-federation/nextjs-mf");

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',
    transpilePackages: ['@mui/x-data-grid'],
    async headers() {
        return [
            {
                source: "/api/:path*",
                headers: [
                    { key: "Access-Control-Allow-Credentials", value: "true" },
                    { key: "Access-Control-Allow-Origin", value: "*" },
                    { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
                    { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, User-Agent" },
                ]
            }
        ]
    },
    webpack(config, options) {
      const { isServer } = options;
      const remoteDir = isServer ? "ssr" : "chunks";

      config.plugins.push(
        new NextFederationPlugin({
          name: "jira",
          filename: `static/${remoteDir}/remoteEntry.js`,
          exposes: {
            "./jira": "./pages/index",
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
