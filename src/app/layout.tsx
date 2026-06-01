import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { PostHogAnalytics } from "@/components/PostHogAnalytics";
import { MobileInstallPrompt } from "@/components/MobileInstallPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { NavigationHistoryTracker } from "@/components/NavigationHistoryTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golf Pools for your favorite majors and pro golf events",
  description: "Golf pools for your favorite majors and pro golf events.",
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
    title: "Golf Pools for your favorite majors and pro golf events",
    description: "Golf pools for your favorite majors and pro golf events.",
    url: "https://www.golfpoolspro.com",
    siteName: "Golf Pools Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Golf Pools for your favorite majors and pro golf events",
    description: "Golf pools for your favorite majors and pro golf events.",
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
        <ServiceWorkerRegister />
        <MobileInstallPrompt />
      </body>
    </html>
  );
}
