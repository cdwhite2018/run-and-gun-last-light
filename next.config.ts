import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGitHubPages ? "/run-and-gun-last-light" : "",
  assetPrefix: isGitHubPages ? "/run-and-gun-last-light/" : "",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
