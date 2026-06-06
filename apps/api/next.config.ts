import type { NextConfig } from "next";

const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || "https://monadmogs.xyz";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: allowedOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
  webpack: (config, { webpack }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    config.plugins.push(
      new webpack.ContextReplacementPlugin(/ox[\\/]_esm[\\/]tempo[\\/]internal$/, /^$/),
    );
    return config;
  },
};

export default nextConfig;
