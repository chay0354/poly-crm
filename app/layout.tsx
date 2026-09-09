import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pm5 — תוצאות",
  description: "Settled Polymarket 5-minute bot P&L",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
