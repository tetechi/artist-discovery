import type { Metadata, Viewport } from "next";
import { Anton } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

export const metadata: Metadata = {
  title: "Artist Discovery — 世界のアーティストと出会う",
  description: "国・ジャンル・年代でフィルタリングして、世界中のアーティストをランダムに発見しよう。",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Artist Discovery",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0b10",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={anton.variable}>{children}</body>
    </html>
  );
}
