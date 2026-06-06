import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
