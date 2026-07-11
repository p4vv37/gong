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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (!theme || theme === 'default') {
                    document.documentElement.classList.toggle('dark', prefersDark);
                  } else if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full font-roboto">
        <ThemeProvider>
          {children}
          <ThemeModal />
        </ThemeProvider>
      </body>
    </html>
  );
}
