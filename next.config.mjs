const nextConfig = {
  outputFileTracingIncludes: {
    "/legacy/\\[\\.\\.\\.asset\\]": ["./dist/**/*"],
  },
  async redirects() {
    return [
      { source: "/admin.html", destination: "/admin", permanent: false },
      { source: "/index.html", destination: "/", permanent: false },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/images/:path*", destination: "/legacy/images/:path*" },
        { source: "/favicon.png", destination: "/legacy/favicon.png" },
        { source: "/apple-touch-icon.png", destination: "/legacy/apple-touch-icon.png" },
      ],
    };
  },
};

export default nextConfig;
