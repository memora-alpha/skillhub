import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL(
        "https://images.unsplash.com/photo-1621570277341-4fea9203f5e0?auto=format&fit=crop&w=1200&q=88",
      ),
    ],
  },
};

export default nextConfig;
