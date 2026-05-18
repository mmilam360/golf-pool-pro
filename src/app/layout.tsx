import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MobileInstallPrompt } from "@/components/MobileInstallPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golf Pools Pro | PGA Golf Pool Manager with Live Leaderboards",
  description: "Run a PGA golf pool online with pick tracking, private join links, automatic scoring, live leaderboards, and clear rules for Masters pools, PGA Championship pools, office pools, and fantasy golf groups.",
  keywords: [
    "PGA golf pool manager",
    "online golf pool manager",
    "golf pool leaderboard",
    "Masters golf pool",
    "PGA Championship pool",
    "fantasy golf pool manager",
    "office golf pool manager",
    "golf tournament pool",
    "golf pool picks",
    "live golf pool standings",
  ],
  applicationName: "Golf Pools Pro",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "https://www.golfpoolspro.com",
  },
  openGraph: {
    title: "Golf Pools Pro | PGA Golf Pool Manager with Live Leaderboards",
    description: "Run a PGA golf pool online with pick tracking, private join links, automatic scoring, and live leaderboards for Masters pools, PGA Championship pools, office pools, and fantasy golf groups.",
    url: "https://www.golfpoolspro.com",
    siteName: "Golf Pools Pro",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: "Golf Pools Pro",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg?v=4", type: "image/svg+xml" },
      { url: "/favicon.ico?v=4", sizes: "any" },
      { url: "/icons/icon-192.png?v=4", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=4",
    apple: "/apple-touch-icon.png?v=4",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b2f24",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <GoogleAnalytics />
        <ServiceWorkerRegister />
        <MobileInstallPrompt />
      </body>
    </html>
  );
}
