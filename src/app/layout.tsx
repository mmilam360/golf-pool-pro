import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { PostHogAnalytics } from "@/components/PostHogAnalytics";
import { MobileInstallPrompt } from "@/components/MobileInstallPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { NavigationHistoryTracker } from "@/components/NavigationHistoryTracker";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golf Pools Pro | Run a golf pool with live scoring",
  description: "Run your golf pool online with live leaderboards, automatic scoring, and no spreadsheet cleanup. Free for small groups and set up in minutes.",
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
    title: "Golf Pools Pro | Run a golf pool with live scoring",
    description: "Run your golf pool online with live leaderboards, automatic scoring, and no spreadsheet cleanup. Free for small groups and set up in minutes.",
    url: "https://www.golfpoolspro.com",
    siteName: "Golf Pools Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Golf Pools Pro | Run a golf pool with live scoring",
    description: "Run your golf pool online with live leaderboards, automatic scoring, and no spreadsheet cleanup. Free for small groups and set up in minutes.",
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
        <NavigationHistoryTracker />
        {children}
        <GoogleAnalytics />
        <PostHogAnalytics />
        <WebVitalsReporter />
        <ServiceWorkerRegister />
        <MobileInstallPrompt />
      </body>
    </html>
  );
}
