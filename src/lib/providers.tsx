"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// HATA DÜZELTMESİ: 'next-themes' importları tek bir satırda birleştirildi ve
// kütüphanenin ana giriş noktasından yapıldı. Bu, sürüm uyumsuzluklarını çözer.
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";
import { Toaster } from "~/components/ui/sonner";

// React Query client'ını yalnızca bir kez oluşturuyoruz.
const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 3,
        staleTime: 5 * 60 * 1000, // 5 dakika
      },
    },
  });
};

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Sunucuda her zaman yeni bir client oluşturulur
    return makeQueryClient();
  } else {
    // Tarayıcıda sadece bir tane client örneği kullanılır
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function Providers({ children, ...props }: ThemeProviderProps) {
  const queryClient = getQueryClient();

  return (
    <NextThemesProvider {...props}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </NextThemesProvider>
  );
}

