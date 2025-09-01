// src/hooks/useProgress.ts
import { useEffect, useRef, useState } from 'react';
import type { RunData, RunStep } from '@/types/n8n';
import { longPollEvents, getProgress } from '@/lib/n8nClient';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** İçerikten terminal state sezgisi - cancel akışları için daha az agresif */
const looksTerminal = (steps: RunStep[], flow: string) => {
  if (!steps.length) return false;
  
  // Son birkaç adımı kontrol et (sadece son adım değil)
  const lastFewSteps = steps.slice(-3);
  
  for (const step of lastFewSteps) {
    const stepName = (step?.name ?? '').toLowerCase();
    const stepMessage = (step?.message ?? '').toLowerCase();
    const txt = `${stepName} ${stepMessage}`;
    
    // "Done" adımını direkt kontrol et
    if (stepName === 'done' || stepMessage === 'done' || /^done$/i.test(stepName)) {
      console.log('[useProgress] Terminal detected: Done step found', step);
      return true;
    }
    
    // "Test tamamlandı" mesajlarını kontrol et  
    if (/test.*tamamland|test.*completed|rapor.*hazır|report.*ready/i.test(txt)) {
      console.log('[useProgress] Terminal detected: Test completion message found', step);
      return true;
    }
  }
  
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

  // Flow parametresi değiştiğinde currentFlow'u güncelle ve polling'i yeniden başlat
  useEffect(() => {
    if (flow !== 'dual') {
      const newFlow = flow as 'payment' | 'cancelRefund';
      if (currentFlow !== newFlow) {
        console.log(`[useProgress] Flow changed from ${currentFlow} to ${newFlow}, forcing restart`);
        setCurrentFlow(newFlow);
        
        // Flow değiştiğinde mevcut polling'i durdur ve yeniden başlat
        if (runKey) {
          abortRef.current?.abort();
          cursorRef.current = 0;
          seenSeqRef.current = new Set();
          
          // Yeni polling'i başlatmak için state'i resetle
          setData({
            status: 'running',
            startTime: new Date().toISOString(),
            endTime: null,
            steps: [],
          });
          setError(null);
        }
      }
    }
  }, [flow, runKey, currentFlow]);

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
      console.log('[useProgress] Starting polling loop for runKey:', runKey);
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
            
            // Mevcut state'ten terminal durumu kontrol et
            setData((prev) => {
              if (prev && prev.steps && looksTerminal(prev.steps, currentFlow)) {
                console.log('[useProgress] Terminal detected during empty response, stopping polling');
                cancelled = true;
              }
              return prev; // State'i değiştirme
            });
            
            if (cancelled) break;
            
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

          // Terminal durumunu setData dışında hesapla
          let terminalByContent = false;
          let terminalByApi = false;

          setData((prev) => {
            const steps = [...(prev?.steps ?? []), ...newSteps];
            terminalByApi = !!(res?.status === 'error' && res?.endTime); // Sadece gerçek error durumu
            terminalByContent = looksTerminal(steps, currentFlow);
            const terminal = terminalByApi || terminalByContent;

            console.log('[useProgress] Terminal check:', {
              terminalByApi,
              terminalByContent,
              terminal,
              stepsCount: steps.length,
              lastStepName: steps[steps.length - 1]?.name
            });

            // Payment tamamlandığında cancel endpoint'ine geç
            if (switchToCancelAfterPayment && currentFlow === 'payment' && !terminal) {
              console.log('[useProgress] Checking for payment success...', { 
                switchToCancelAfterPayment, 
                currentFlow, 
                terminal, 
                stepsCount: steps.length 
              });
              
              // Payment adımlarında "payment success" veya benzeri var mı kontrol et
              const hasPaymentSuccess = steps.some(step => {
                const content = `${step.name || ''} ${step.message || ''}`.toLowerCase();
                const isSuccess = /payment.*success|ödeme.*başar|payment.*complete|işlem.*başar/i.test(content);
                if (isSuccess) {
                  console.log('[useProgress] Found payment success step:', step.name, step.message);
                }
                return isSuccess;
              });
              
              // Yeni cancel/refund runKey'i var mı kontrol et
              const cancelRunKeyStep = steps.find(step => {
                const content = `${step.name || ''} ${step.message || ''}`.toLowerCase();
                const hasCancelKey = /cancel.*started|refund.*started|cancel.*runkey|refund.*runkey/i.test(content);
                if (hasCancelKey) {
                  console.log('[useProgress] Found cancel runKey step:', step.name, step.message);
                }
                return hasCancelKey;
              });
              
              console.log('[useProgress] Payment success check result:', { 
                hasPaymentSuccess, 
                hasCancelRunKeyStep: !!cancelRunKeyStep 
              });
              
              if (hasPaymentSuccess && cancelRunKeyStep) {
                console.log('[useProgress] Payment success and cancel runKey detected');
                // Response'da yeni runKey'i ara
                const response = cancelRunKeyStep.response as any;
                const newRunKey = response?.runKey || 
                                 response?.cancelRunKey ||
                                 cancelRunKeyStep.message?.match(/runkey[:\s]+([a-zA-Z0-9\-_]+)/i)?.[1];
                
                if (newRunKey && onPaymentSuccess) {
                  // RunKey'den başındaki = işaretini temizle
                  const cleanNewRunKey = newRunKey.replace(/^=+/, '');
                  console.log('[useProgress] Found new cancel runKey:', newRunKey, '-> cleaned:', cleanNewRunKey);
                  console.log('[useProgress] Switching to cancelRefund flow and restarting polling');
                  
                  // Flow'u değiştir ve polling'i yeniden başlat
                  setCurrentFlow('cancelRefund');
                  
                  // Mevcut polling'i durdur
                  cancelled = true;
                  abortRef.current?.abort();
                  
                  onPaymentSuccess(cleanNewRunKey);
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
          if (terminalByApi || terminalByContent) {
            console.log('[useProgress] Terminal condition met, stopping polling:', {
              terminalByApi,
              terminalByContent,
              lastStep: newSteps[newSteps.length - 1]?.name
            });
            break;
          }

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
      console.log('[useProgress] Polling loop ended for runKey:', runKey, 'cancelled:', cancelled);
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