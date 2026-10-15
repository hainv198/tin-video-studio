import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tin Video Studio",
  description: "Dựng video tin tức dọc 9:16 từ văn bản",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
