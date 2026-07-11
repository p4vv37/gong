import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
