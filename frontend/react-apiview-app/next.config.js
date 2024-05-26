/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ["react-leaflet", "react-leaflet-cluster"],
    experimental: {
        esmExternals: "loose",
    },
    async rewrites() {
        return [
            {
                source: "/:path*",
                destination: "/",
            },
        ];
    },
    reactStrictMode: false,
    eslint: {
        ignoreDuringBuilds: true,
    },
    output: 'standalone',
}

module.exports = nextConfig
