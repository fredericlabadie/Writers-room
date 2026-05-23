import type { Metadata } from "next";
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
