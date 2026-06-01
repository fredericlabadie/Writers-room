import type { Metadata } from "next";
import Script from "next/script";
import AmplitudeInit from "@/components/AmplitudeInit";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Writers Room",
  description: "A collaborative AI studio for story writing and worldbuilding",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script id="fl-consent-config" strategy="beforeInteractive">{`
          window.FLConsentConfig = {
            appId: "writersroom",
            appName: "Writers Room",
            cookieName: "fl_consent_writersroom",
            bannerText: "Writers Room uses necessary storage to remember this choice. With your permission, it also uses Amplitude analytics and session replay to understand how the studio is used. Analytics is optional — you can decline and still use the tool.",
            theme: "dark"
          };
        `}</Script>
        <Script
          id="fl-consent"
          src="https://fredericlabadie.com/js/fl-consent.js"
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
