"use client";

import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { CheckCircle, Loader2, TestTube2, XCircle } from "lucide-react";
import type { TestRun, TestRunStep } from "../types";
import { cn } from "~/lib/utils";

interface LiveResultsDisplayProps {
  activeRun: TestRun | null;
  isLoading: boolean;
}

export function LiveResultsDisplay({
  activeRun,
  isLoading,
}: LiveResultsDisplayProps) {
  const getStatusIcon = (status: TestRunStep["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col items-center justify-center h-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
          <h3 className="text-xl font-semibold mt-4">Veriler Yükleniyor...</h3>
          <p className="text-muted-foreground">Test sonuçları getiriliyor.</p>
        </CardContent>
      </Card>
    );
  }

  if (!activeRun) {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col items-center justify-center h-full text-center">
          <TestTube2 className="h-16 w-16 text-muted-foreground" />
          <h3 className="text-xl font-semibold mt-4">Test Sonuçları</h3>
          <p className="text-muted-foreground">
            Bir test başlattığınızda veya geçmiş bir testi seçtiğinizde sonuçlar
            burada görünecektir.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Test Sonucu</CardTitle>
            <CardDescription className="font-mono text-xs pt-1">
              {activeRun.run_key}
            </CardDescription>
          </div>
          {/* Hata Düzeltmesi: Badge bileşeninin `variant` prop'u 'success' değerini kabul etmez.
              Bunun yerine, `cn` utility'si ile koşullu olarak renk sınıfları ekliyoruz.
              'completed' durumu için yeşil, 'error' için kırmızı ve 'running' için varsayılan renkler kullanılacak.
          */}
          <Badge
            className={cn(
              activeRun.status === "completed" && "bg-green-600 text-white",
              activeRun.status === "error" && "bg-red-600 text-white"
            )}
            variant={
              activeRun.status === "error" ? "destructive" : "default"
            }
          >
            {activeRun.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {activeRun.result && (
          <div className="mb-4 p-4 bg-muted rounded-lg text-sm">
            <p className="font-semibold">Özet:</p>
            <p>{activeRun.result.summary || JSON.stringify(activeRun.result)}</p>
          </div>
        )}
        <ScrollArea className="h-[500px] pr-4">
          <div className="relative pl-6">
            <div className="absolute left-[31px] top-[10px] bottom-0 w-0.5 bg-border -translate-x-1/2"></div>
            {activeRun.steps?.map((step, index) => (
              <div
                key={index}
                className="relative flex items-start space-x-4 mb-6"
              >
                <div className="absolute left-[32px] top-1.5 h-full -translate-x-1/2">
                  <div className="bg-background h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-background">
                    {getStatusIcon(step.status)}
                  </div>
                </div>
                <div className="flex-grow pl-8">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold">{step.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(step.time).toLocaleTimeString("tr-TR")}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {step.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

