import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "~/lib/providers";
import { cn } from "~/lib/utils";
import { Sidebar } from "~/components/layout/sidebar";
import { Header } from "~/components/layout/header";

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
        <Providers>
          {/* DÜZELTME: Sidebar ve ana içerik alanı için doğru flexbox yapısı kuruldu. */}
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
              <Header />
              <main>
                <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}

