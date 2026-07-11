import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeModal } from "@/components/theme-modal";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhatsApp",
  description: "WhatsApp UI clone",
  icons: {
    icon: "/imgs/favicon-32x32.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-full overflow-hidden font-roboto">
        <ThemeProvider>
          {children}
          <ThemeModal />
        </ThemeProvider>
      </body>
    </html>
  );
}
