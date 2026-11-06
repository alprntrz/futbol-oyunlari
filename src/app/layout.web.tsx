import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Tiktako | شبكة الدوري السعودي اليومية",
  description: "كم لاعبًا تعرف من الدوري السعودي؟ شبكة جديدة كل يوم. ثلاث دقائق، بدون تحميل أو تسجيل.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14532d" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f1f4f1] font-[family-name:var(--font-body)] text-[#0e1a14]">{children}</body>
    </html>
  );
}
