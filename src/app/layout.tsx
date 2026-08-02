import type { Metadata } from "next";
import { Nunito, Press_Start_2P } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin", "latin-ext"], variable: "--font-body" });
const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const metadata: Metadata = {
  title: "Futbol Oyunları — Eksik 11",
  description:
    "Tarihi maçların ilk 11'ini tahmin et. Günlük futbol bulmaca oyunları.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${nunito.variable} ${pixel.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-gradient-to-b from-[#160f2a] to-[#241640] font-[family-name:var(--font-body)] text-zinc-100">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
