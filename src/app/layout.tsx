import type { Metadata } from "next";
import { Archivo, Newsreader } from "next/font/google";
import "./globals.css";

const sans = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
});

const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "gong · purchase intelligence",
  description: "An evidence-driven purchasing agent that asks only warranted questions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${sans.variable} ${serif.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
