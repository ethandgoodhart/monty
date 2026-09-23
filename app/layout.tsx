import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trymonty.ai"),
  title: "Monterey AI",
  openGraph: { title: "Monterey AI", url: "/", siteName: "Monterey AI", type: "website" },
  twitter: { card: "summary_large_image", title: "Monterey AI" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
