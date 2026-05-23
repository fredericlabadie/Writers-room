import type { Metadata } from "next";
import Script from "next/script";
import AmplitudeInit from "@/components/AmplitudeInit";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Writers Room",
  description: "A collaborative AI studio for story writing and worldbuilding",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          id="Cookiebot"
          src="https://consent.cookiebot.com/uc.js"
          data-cbid="d8d8cb40-e8e6-4ca0-852d-bfb6cd1aac42"
          data-blockingmode="auto"
          strategy="beforeInteractive"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AmplitudeInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
