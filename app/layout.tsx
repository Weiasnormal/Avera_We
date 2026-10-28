import type { Metadata, Viewport } from "next";
import { Sora } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { Toaster } from "@/components/feedback/toaster";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Avera",
    template: "%s · Avera",
  },
  description: "Avera — assistive forensic signature verification for document examiners.",
};

export const viewport: Viewport = {
  themeColor: "#1e6fd9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
}
