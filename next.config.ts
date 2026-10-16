import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Chỉ có tác dụng khi chạy dev: cho phép mở bằng 127.0.0.1 và địa chỉ mạng nội bộ (nếu không, trang hiện chữ nhưng mọi nút đều không bấm được).
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
