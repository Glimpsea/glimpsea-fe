import type { Metadata } from "next";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/fraunces/latin-400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glimpsea | Etsy Product Research",
  description: "Read Etsy search results in your browser and review the listings behind a product idea.",
  icons: { icon: { url: "/glimpsea-logo.svg", type: "image/svg+xml", sizes: "any" } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
