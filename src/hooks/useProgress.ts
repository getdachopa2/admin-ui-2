// src/hooks/useProgress.ts
import { useEffect, useRef, useState } from 'react';
import type { RunData, RunStep } from '@/types/n8n';
import { longPollEvents, getProgress } from '@/lib/n8nClient';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** İçerikten terminal state sezgisi - cancel akışları için daha az agresif */
const looksTerminal = (steps: RunStep[], flow: string) => {
  if (!steps.length) return false;
  const last = steps[steps.length - 1];
  const txt = `${last?.name ?? ''} ${last?.message ?? ''}`.toLowerCase();
  
  // Cancel/Refund akışları için terminal koşulları
  if (flow === 'cancelRefund') {
    return /final.*rapor|report.*final|tamamlan.*son|cancel.*success|iptal.*başar|refund.*success|iade.*başar/i.test(txt);
  }
  
  // Payment akışları için daha geniş terminal kontrol
  return /final|rapor|report|tamamlan|payment.*success|ödeme.*başar/i.test(txt);
};

/**
 * waitSec: sunucuya uzun-poll timeout (saniye)
 * minGapMs: İKİ çağrı arası minimum bekleme (ms) – istemci tarafı throttle
 * flow: 'payment' | 'cancelRefund' | 'dual' - hangi endpoint'i kullanacağı
 * switchToCancelAfterPayment: payment tamamlandığında cancel endpoint'ine geç
 */
export function useProgress(
  params: {
    runKey: string | null;
    flow?: 'payment' | 'cancelRefund' | 'dual';
    switchToCancelAfterPayment?: boolean;
    onPaymentSuccess?: (newRunKey?: string) => void; // Payment başarısında çağrılacak callback, yeni runKey ile
    waitSec?: number;
    minGapMs?: number;
  }
) {
  const { runKey, flow = 'payment', switchToCancelAfterPayment = false, onPaymentSuccess, waitSec = 25, minGapMs = 2000 } = params;
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentFlow, setCurrentFlow] = useState<'payment' | 'cancelRefund'>(
    flow === 'dual' ? 'payment' : (flow as 'payment' | 'cancelRefund')
  );

  const abortRef = useRef<AbortController | null>(null);
  const cursorRef = useRef(0);
  const loopIdRef = useRef(0);

  // DÜZELTME: Görülen adımların sequence numaralarını takip etmek için bir ref eklendi.
  const seenSeqRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!runKey) return;

    console.log(`[useProgress] Starting with flow: ${flow}, runKey: ${runKey}`);

    // başlangıç state
    setData({
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: null,
      steps: [],
    });
    setError(null);

    // önceki poll’u iptal et
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    cursorRef.current = 0;

    // DÜZELTME: Yeni bir çalıştırma başladığında 'görülenler' set'ini sıfırla.
    seenSeqRef.current = new Set();

    const myLoopId = ++loopIdRef.current;

    let cancelled = false;
    let emptyHits = 0; // arka arkaya boş dönüş sayacı (backoff için)
    let errorCount = 0; // arka arkaya hata sayacı

    const loop = async () => {
      while (!cancelled && loopIdRef.current === myLoopId) {
        const t0 = Date.now();
        try {
          // N8N progress endpoint sorunlu olabilir, önce events ile deneyelim
          const res = await longPollEvents(
            runKey,
            cursorRef.current,
            waitSec,
            abortRef.current!.signal,
            currentFlow // Dinamik flow kullan
          );

          // Başarılı istek sonrası error count'u sıfırla
          errorCount = 0;

          const raw = Array.isArray(res?.events) ? res.events : [];

          // DÜZELTME: Gelen adımları, daha önce görülmemiş olanlara göre filtrele.
          const uniqueNewEvents = raw.filter((e) => {
            if (typeof e.seq !== 'number' || seenSeqRef.current.has(e.seq)) {
              return false; // Eğer 'seq' yoksa veya zaten set'te varsa atla.
            }
            // Yeni 'seq' numarasını set'e ekle ve adımı koru.
            seenSeqRef.current.add(e.seq);
            return true;
          });

          // Eğer filtrelenmiş yeni adım yoksa, state'i güncellemeye gerek yok.
          if (uniqueNewEvents.length === 0) {
            // Sadece cursor'ı güncelle ve döngüye devam et.
            cursorRef.current = typeof res?.nextCursor === 'number' ? res.nextCursor : cursorRef.current;
            // Sadece açık error durumunda dur
            if (res?.status === 'error' && res?.endTime) break;
            await sleep(minGapMs); // Boş istek sonrası bekleme
            continue;
          }
          
          const newSteps: RunStep[] = uniqueNewEvents.map((e) => ({
            seq: e.seq, // DÜZELTME: 'seq' numarasını RunStep nesnesine ekle.
            time: e.time,
            name: e.name,
            status:
              e.status === 'running' || e.status === 'success' || e.status === 'error'
                ? e.status
                : 'running',
            message: e.message,
            request: e.request,
            response: e.response,
          }));

          const nextCursor =
            typeof res?.nextCursor === 'number' ? res.nextCursor : cursorRef.current;

          const hasNew = newSteps.length > 0 || nextCursor !== cursorRef.current;

          let terminalByContent = false;

          setData((prev) => {
            const steps = [...(prev?.steps ?? []), ...newSteps];
            const terminalByApi =
              res?.status === 'error' && res?.endTime; // Sadece gerçek error durumu
            terminalByContent = looksTerminal(steps, currentFlow);
            const terminal = terminalByApi || terminalByContent;

            // Payment tamamlandığında cancel endpoint'ine geç
            if (switchToCancelAfterPayment && currentFlow === 'payment' && !terminal) {
              // Payment adımlarında "payment success" veya benzeri var mı kontrol et
              const hasPaymentSuccess = steps.some(step => {
                const content = `${step.name || ''} ${step.message || ''}`.toLowerCase();
                return /payment.*success|ödeme.*başar|payment.*complete|işlem.*başar/i.test(content);
              });
              
              // Yeni cancel/refund runKey'i var mı kontrol et
              const cancelRunKeyStep = steps.find(step => {
                const content = `${step.name || ''} ${step.message || ''}`.toLowerCase();
                return /cancel.*started|refund.*started|cancel.*runkey|refund.*runkey/i.test(content);
              });
              
              if (hasPaymentSuccess && cancelRunKeyStep) {
                console.log('[useProgress] Payment success and cancel runKey detected');
                // Response'da yeni runKey'i ara
                const response = cancelRunKeyStep.response as any;
                const newRunKey = response?.runKey || 
                                 response?.cancelRunKey ||
                                 cancelRunKeyStep.message?.match(/runkey[:\s]+([a-zA-Z0-9\-_]+)/i)?.[1];
                
                if (newRunKey && onPaymentSuccess) {
                  console.log('[useProgress] Found new cancel runKey:', newRunKey);
                  onPaymentSuccess(newRunKey);
                  return prev;
                }
              }
            }

            return {
              status: terminal
                ? (res?.status ?? 'completed')
                : (res?.status ?? prev?.status ?? 'running'),
              startTime: prev?.startTime,
              endTime: terminal
                ? (res?.endTime ?? new Date().toISOString())
                : (prev?.endTime ?? null),
              steps,
              result: prev?.result,
              params: (prev as any)?.params,
            };
          });

          cursorRef.current = nextCursor;

          // çıkış koşulu - error durumu veya terminal content algılandığında dur
          if ((res?.status === 'error' && res?.endTime) || terminalByContent) break;

          // ---- İstemci-tarafı throttle + backoff ----
          const elapsed = Date.now() - t0;
          const baseGap = Math.max(minGapMs - elapsed, 0);
          const backoff = !hasNew ? Math.min(5000, 500 * (emptyHits + 1)) : 0;
          emptyHits = !hasNew ? Math.min(emptyHits + 1, 10) : 0;

          await sleep(baseGap + backoff);
        } catch (e: any) {
          if (e?.name === 'AbortError' || cancelled || loopIdRef.current !== myLoopId) break;
          
          errorCount++;
          console.error(`useProgress error (${errorCount}):`, e?.message || String(e));
          setError(`Network error: ${e?.message || String(e)}`);
          
          // 5 hata sonrası polling'i durdur
          if (errorCount >= 5) {
            console.error('Too many errors, stopping progress polling');
            break;
          }
          
          // Exponential backoff: 3s, 6s, 12s, 24s, 48s
          const backoffTime = Math.min(3000 * Math.pow(2, errorCount - 1), 48000);
          await sleep(backoffTime);
        }
      }
    };

    loop();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [runKey, waitSec, minGapMs, currentFlow, switchToCancelAfterPayment]);

  return { data, error };
}