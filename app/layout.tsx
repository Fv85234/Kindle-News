import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kindle News Daily Digest",
  description: "A personal daily Kindle digest built from reputable news sources."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
