"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Loader2, Play } from "lucide-react";

// Form şeması ve tipleri
const formSchema = z.object({
  runMode: z.enum(["payment_only", "all"]),
  cardSelectionMode: z.enum(["automatic", "manual"]),
});

type FormValues = z.infer<typeof formSchema>;

interface TestControlPanelProps {
  onStartTest: (values: FormValues) => void;
  isStarting: boolean;
}

export function TestControlPanel({
  onStartTest,
  isStarting,
}: TestControlPanelProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      runMode: "all",
      cardSelectionMode: "automatic",
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yeni Test Başlat</CardTitle>
        <CardDescription>
          Test parametrelerini seçerek yeni bir n8n akışı tetikleyin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onStartTest)} className="space-y-6">
            <FormField
              control={form.control}
              name="runMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Test Modu</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Bir test modu seçin..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">Ödeme + İptal/İade</SelectItem>
                      <SelectItem value="payment_only">Sadece Ödeme</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cardSelectionMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kart Seçim Yöntemi</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Bir seçim yöntemi belirleyin..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="automatic">Otomatik</SelectItem>
                      <SelectItem value="manual" disabled>
                        Manuel (Yakında)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isStarting}>
              {isStarting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Testi Başlat
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
