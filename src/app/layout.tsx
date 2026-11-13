import type { Metadata } from "next";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/fraunces/latin-400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glimpsea | Etsy Product Research",
  description: "See how a buyer agent compares Etsy product ideas and picks one to test.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
