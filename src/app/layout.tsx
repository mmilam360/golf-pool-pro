import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Golf Pool Pro",
  description: "Create and manage golf pools with live PGA scoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
