import type { Metadata } from "next";
import "@fontsource/permanent-marker/latin-400.css";
import "@fontsource/special-elite/latin-400.css";
import "@fontsource/courier-prime/latin-400.css";
import "@fontsource/courier-prime/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glimpsea | Etsy Wall Art Research",
  description: "See how a buyer agent orders an Etsy wall art research brief.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
