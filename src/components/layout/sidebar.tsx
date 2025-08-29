"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "~/lib/nav-links";
import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { TestTubeDiagonal } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <Link
          href="/"
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
        >
          <TestTubeDiagonal className="h-4 w-4 transition-all group-hover:scale-110" />
          <span className="sr-only">Test Otomasyon Paneli</span>
        </Link>
        <TooltipProvider>
          {navLinks.map((link) => {
            // Hata Düzeltmesi: 'link.icon' bir bileşen tipi (LucideIcon).
            // Onu 'Icon' adında büyük harfle başlayan bir değişkene atayarak
            // React'in bunu bir bileşen olarak tanımasını sağlıyoruz.
            const Icon = link.icon;
            return (
              <Tooltip key={link.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={link.href}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8",
                      pathname === link.href &&
                        "bg-accent text-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="sr-only">{link.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{link.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </nav>
    </aside>
  );
}

