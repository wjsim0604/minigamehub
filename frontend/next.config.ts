import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MVP는 정적 호스팅 (requirements.md 6장, ADR-0003)
  output: "export",
  // 정적 호스팅에서 /games/2048 -> /games/2048/index.html 로 제공되도록 함
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
