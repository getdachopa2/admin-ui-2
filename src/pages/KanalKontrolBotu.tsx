// src/pages/KanalKontrolBotu.tsx
import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { IndeterminateBar, SolidProgress, RateLimitProgress } from "@/components/ProgressBar";
import { useProgress } from "@/hooks/useProgress";
import { useRateLimit } from "@/hooks/useRateLimit";
import { startPayment, startCancelOrRefund } from "@/lib/n8nClient";
import Wizard from "@/components/wizard/Wizard";
import { saveRun, type SavedRun } from "@/lib/runsStore";
import DetailedTestReport from "@/components/DetailedTestReport";

/* =================================================================== */
export default function KanalKontrolBotu() {
  const SAVE_LOCAL = import.meta.env.VITE_SAVE_LOCAL_RUNS === "true";

  // Rate limiting (5 saniye minimum interval)
  const rateLimit = useRateLimit({ minInterval: 5000 });

  // Wizard modal
  const [wizardOpen, setWizardOpen] = useState(false);

  // Çalıştırma / progress
  const [runKey, setRunKey] = useState<string | null>(null);
  const [currentFlow, setCurrentFlow] = useState<'payment' | 'cancelRefund'>('payment');
  const [isAllFlow, setIsAllFlow] = useState(false); // ALL akışı mı?
  
  const { data: prog, error: progErr } = useProgress({ 
    runKey, 
    flow: isAllFlow ? 'dual' : currentFlow, 
    switchToCancelAfterPayment: isAllFlow 
  });
  const steps = prog?.steps ?? [];
  const running = prog?.status === "running";

  // Akış türüne göre tamamlanma kontrolü
  const isCompleted = useMemo(() => {
    if (!prog || running) return false;
    
    // Status-based kontrol
    if (prog.status === 'completed' || prog.status === 'error') return true;
    
    // Content-based kontrol: son adımda terminal kelimeler var mı?
    if (steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      const content = `${lastStep.name || ''} ${lastStep.message || ''}`.toLowerCase();
      
      if (currentFlow === 'cancelRefund') {
        // Cancel/Refund akışı için spesifik terminal kelimeler
        return /cancel.*success|iptal.*başar|refund.*success|iade.*başar|işlem.*tamamlan|final.*rapor/i.test(content);
      } else {
        // Payment akışı için genel terminal kelimeler
        return /payment.*success|ödeme.*başar|işlem.*tamamlan|final.*rapor|tamamlan/i.test(content);
      }
    }
    
    return false;
  }, [prog, running, steps, currentFlow]);

  // Ticker: sunucudan event gelmeden hemen görünsün diye ilk yerel step
  const [echoSteps, setEchoSteps] = useState<
    Array<{ time: string; name: string; status: string; message?: string }>
  >([]);

  const liveSteps = useMemo(() => [...echoSteps, ...steps], [echoSteps, steps]);
  const listSteps = useMemo(() => (running ? liveSteps : steps), [running, liveSteps, steps]);

  // Wizard verilerini N8N payload'ına dönüştürme fonksiyonu
  function buildN8nPayload(wizardData: any) {
    const { scenarios, env, channelId, application, cardSelectionMode, manualCards, cardCount, payment, cancelRefund } = wizardData;
    
    // Scenario'lara göre runMode belirle
    const runMode = scenarios.includes('ALL') ? 'all' : 
                   scenarios.some((s: string) => ['CANCEL', 'REFUND'].includes(s)) ? 'all' :
                   'payment-only';

    // Scenario'lara göre action belirle
    let action = 'payment';
    let flowType: 'payment' | 'cancelRefund' | 'all' = 'payment';
    
    if (scenarios.includes('CANCEL')) {
      action = 'cancel';
      flowType = 'cancelRefund';
    } else if (scenarios.includes('REFUND')) {
      action = 'refund';
      flowType = 'cancelRefund';
    } else if (scenarios.includes('ALL')) {
      action = 'payment'; // ALL durumunda payment ile başla, sonunda cancel tetikler
      flowType = 'all'; // İki endpoint'i de dinle
    }

    const payload = {
      env: env || 'stb',
      channelId: channelId || 'TURKCELL_PORTAL',
      segment: 'segment01',
      application: application || {
        applicationName: 'TURKCELL_PORTAL',
        applicationPassword: 'password123',
        secureCode: 'secure123',
        transactionId: `TXN_${Date.now()}`,
        transactionDateTime: new Date().toISOString(),
      },
      userId: payment?.userId || 'test_user',
      userName: payment?.userName || 'Test User',
      payment: {
        paymentType: (payment?.paymentType?.toLowerCase() || 'creditcard') as 'creditcard' | 'debitcard' | 'prepaidcard',
        threeDOperation: payment?.threeDOperation || false,
        installmentNumber: payment?.installmentNumber || 0,
        options: payment?.options || {
          includeMsisdnInOrderID: false,
          checkCBBLForMsisdn: true,
          checkCBBLForCard: true,
          checkFraudStatus: false,
        },
      },
      products: [{
        amount: payment?.amount || 10,
        msisdn: payment?.msisdn || '5303589836',
      }],
      cardSelectionMode: cardSelectionMode || 'automatic',
      manualCards: cardSelectionMode === 'manual' ? manualCards : undefined,
      cardCount: cardSelectionMode === 'automatic' ? (cardCount || 10) : undefined,
      action: action as 'payment' | 'cancel' | 'refund',
      runMode: runMode as 'payment-only' | 'all',
      paymentRef: cancelRefund?.selectedCandidate ? { paymentId: cancelRefund.selectedCandidate.paymentId } : undefined,
    };

    // Gereksiz undefined alanları temizle
    Object.keys(payload).forEach(key => {
      if ((payload as any)[key] === undefined) {
        delete (payload as any)[key];
      }
    });

    return payload;
  }

  async function onWizardComplete(wizardData: any) {
    if (!rateLimit.canMakeRequest) {
      alert(`Rate limit aktif. ${Math.ceil(rateLimit.remainingTime / 1000)} saniye sonra tekrar deneyin.`);
      return;
    }

    try {
      // Wizard verilerini N8N payload'ına dönüştür
      const payload = buildN8nPayload(wizardData);
      console.log('N8N Payload:', payload); // Debug için
      
      // Action'a göre doğru endpoint'i ve flow'u seç
      const isCancelRefundFlow = payload.action === 'cancel' || payload.action === 'refund';
      const isAllFlow = wizardData.scenarios.includes('ALL');
      const startFunction = isCancelRefundFlow ? startCancelOrRefund : startPayment;
      
      // Flow tipini ayarla
      const newFlow = isCancelRefundFlow ? 'cancelRefund' : 'payment';
      console.log(`[KanalKontrolBotu] Setting flow to: ${newFlow}, action: ${payload.action}, isAll: ${isAllFlow}`);
      setCurrentFlow(newFlow);
      setIsAllFlow(isAllFlow);
        
      const res = await rateLimit.executeRequest(() => startFunction(payload));
      setRunKey(res.runKey);
      setWizardOpen(false);
    } catch (e) {
      alert("Start error: " + (e as Error).message);
    }
  }

  // Koşu tamamlanınca son 5'e kaydet
  React.useEffect(() => {
    if (!SAVE_LOCAL) return;
    if (!runKey || !prog || (prog.status !== "completed" && prog.status !== "error")) return;
    const toSave: SavedRun = {
      runKey,
      savedAt: new Date().toISOString(),
      data: {
        status: prog.status,
        startTime: prog.startTime,
        endTime: prog.endTime ?? null,
        steps: prog.steps,
        result: prog.result,
        params: {},
      },
    };
    saveRun(toSave);
  }, [prog?.status, runKey, SAVE_LOCAL, prog]);

  return (
    <div className="space-y-6">
      {/* Üst kart */}
      <div className="card p-6">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-base-100">Kanal Kontrol Botu</h1>
        <p className="max-w-3xl text-sm leading-6 text-base-300">
          **Unified Test Interface** - Payment, Cancel, Refund akışlarını tek noktadan yönetin. 
          Artık farklı tool'lar yerine sihirbazla guided test yapın.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <button
            className="btn"
            onClick={() => setWizardOpen(true)}
            disabled={!rateLimit.canMakeRequest}
          >
            Test Sihirbazını Aç
          </button>
          
          {!rateLimit.canMakeRequest && (
            <div className="flex-1 max-w-xs">
              <RateLimitProgress remainingTime={rateLimit.remainingTime} />
            </div>
          )}
        </div>
      </div>

      {/* Progress Panel */}
      {runKey && (
        <>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-base-400">
                Run Key: <code className="rounded bg-base-800 px-1 text-base-100">{runKey}</code>
              </div>
              <div className="w-56">
                {running ? (
                  <IndeterminateBar message={`${currentFlow === 'cancelRefund' ? 'Cancel/Refund' : 'Payment'} testi çalışıyor...`} />
                ) : isCompleted ? (
                  <SolidProgress 
                    value={100} 
                    message={currentFlow === 'cancelRefund' ? 'Cancel/Refund Tamamlandı' : 'Payment Tamamlandı'} 
                  />
                ) : (
                  <SolidProgress value={0} message="Bekliyor..." />
                )}
              </div>
            </div>
            
            {/* Webhook dinleme bilgisi */}
            <div className="mt-2 text-xs text-base-500">
              📡 Webhook dinleniyor: <code className="rounded bg-base-800 px-1 text-base-200">
                {isAllFlow ? (
                  currentFlow === 'payment' 
                    ? '/webhook-test/payment-test/events → /webhook-test/payment-test/cancel-refund/events' 
                    : '/webhook-test/payment-test/cancel-refund/events'
                ) : (
                  currentFlow === 'payment' 
                    ? '/webhook-test/payment-test/events' 
                    : '/webhook-test/payment-test/cancel-refund/events'
                )}
              </code>
              {isAllFlow && (
                <span className="ml-2 text-yellow-400 text-xs">
                  (Payment başarısı sonrası Cancel endpoint'ine geçiş)
                </span>
              )}
            </div>
            
            {progErr && <div className="mt-2 text-sm text-red-400">Hata: {progErr}</div>}

            {/* Adımlar */}
            <div className="mt-4">
              <div className="mb-2 font-medium">Test Adımları</div>
              <ul className="max-h-80 space-y-2 overflow-auto">
                {listSteps.map((s, i) => (
                  <li key={`${s.time}-${i}`} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          s.status === "success"
                            ? "bg-emerald-500"
                            : s.status === "error"
                            ? "bg-red-500"
                            : "bg-amber-500"
                        }`}
                      />
                      <span className="font-medium">{s.name}</span>
                      {s.message && <span className="text-base-400">— {s.message}</span>}
                    </div>
                    <div className="ml-4 text-xs text-base-500">{new Date(s.time).toLocaleString()}</div>
                  </li>
                ))}
                {!listSteps.length && <li className="text-sm text-base-500">Test başlamadı...</li>}
              </ul>
            </div>
          </div>

          {/* Detaylı Rapor */}
          <div className="card p-6">
            <div className="mb-4 font-medium">
              Detaylı Test Raporu
              {currentFlow === 'cancelRefund' && <span className="ml-2 text-xs text-blue-400">(Cancel/Refund Akışı)</span>}
              {currentFlow === 'payment' && <span className="ml-2 text-xs text-green-400">(Payment Akışı)</span>}
            </div>

            {running && !isCompleted && (
              <div className="rounded-xl border border-base-800 bg-base-900 p-4 text-sm text-base-400">
                {currentFlow === 'cancelRefund' 
                  ? 'Cancel/Refund testi sürüyor... Detaylar hazır olduğunda görünecek.' 
                  : 'Payment testi sürüyor... Detaylar hazır olduğunda görünecek.'
                }
              </div>
            )}

            {/* Hiyerarşik Test Raporu */}
            <DetailedTestReport steps={listSteps} />
          </div>
        </>
      )}

      {/* Yeni Wizard Modal */}
      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title="Test Sihirbazı">
        <Wizard onComplete={onWizardComplete} onCancel={() => setWizardOpen(false)} />
      </Modal>
    </div>
  );
}
