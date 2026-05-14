import type { Metadata, Viewport } from "next";
import { MobileInstallPrompt } from "@/components/MobileInstallPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golf Pools Pro | Golf Pool App with Live Leaderboards",
  description: "Create a PGA golf pool, collect picks by link, lock entries at tee time, and follow a live leaderboard. First 5 entries free, then $1 per extra entry, capped at $25 per pool.",
  keywords: [
    "golf pool app",
    "golf pool software",
    "PGA golf pool",
    "Masters pool",
    "PGA Championship pool",
    "fantasy golf pool",
    "office golf pool",
    "golf leaderboard",
    "golf tournament pool",
  ],
  applicationName: "Golf Pools Pro",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Golf Pools Pro | Golf Pool App with Live Leaderboards",
    description: "Create golf pools, collect picks, and follow live standings without a spreadsheet.",
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
        <ServiceWorkerRegister />
        <MobileInstallPrompt />
      </body>
    </html>
  );
}
