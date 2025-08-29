import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "~/lib/providers"; // Providers bileşenini import ediyoruz
import { cn } from "~/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Admin UI - Test Otomasyon Paneli",
  description: "n8n test akışları için profesyonel yönetim paneli",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
        {/* Tüm uygulamayı Providers ile sarıyoruz */}
        <Providers attribute="class" defaultTheme="system" enableSystem>
          {children}
        </Providers>
      </body>
    </html>
  );
}
