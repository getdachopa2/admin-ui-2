// src/pages/KanalKontrolBotu.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "@/components/Modal";
import { RateLimitProgress } from "@/components/ProgressBar";
import { useRateLimit } from "@/hooks/useRateLimit";
import { startPayment, startCancelOrRefund } from "@/lib/n8nClient";
import Wizard from "@/components/wizard/Wizard";
import { getAllRuns } from "@/lib/runsStore";

/* =================================================================== */
export default function KanalKontrolBotu() {
  const SAVE_LOCAL = import.meta.env.VITE_SAVE_LOCAL_RUNS === "true";
  const navigate = useNavigate();

  // Rate limiting (5 saniye minimum interval)
  const rateLimit = useRateLimit({ minInterval: 5000 });

  // Wizard modal
  const [wizardOpen, setWizardOpen] = useState(false);

  // Dashboard Metrikleri
  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    totalRequests: 0,
    avgResponseTime: 0,
    todayRuns: 0,
    activeFlows: 0
  });

  // Metrik hesaplama - API'den al, yoksa local'den
  useEffect(() => {
    const fetchKanalMetrics = async () => {
      try {
        // Önce API'yi dene
        const response = await fetch('/api/kanal/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setDashboardMetrics(data.metrics);
            return;
          }
        }
        
        // API başarısız, local data kullan
        if (SAVE_LOCAL) {
          const allRuns = getAllRuns();
          const today = new Date().toDateString();
          
          const todayRuns = allRuns.filter(run => 
            new Date(run.savedAt).toDateString() === today
          );
          
          const successfulRuns = allRuns.filter(run => 
            run.data.status === 'completed'
          ).length;
          
          const failedRuns = allRuns.filter(run => 
            run.data.status === 'error'
          ).length;
          
          const totalRequests = allRuns.reduce((sum, run) => 
            sum + (run.data.steps?.length || 0), 0
          );
          
          // Ortalama response time hesaplama (ms)
          const responseTimes = allRuns
            .filter(run => run.data.startTime && run.data.endTime)
            .map(run => {
              const start = new Date(run.data.startTime!).getTime();
              const end = new Date(run.data.endTime!).getTime();
              return end - start;
            });
          
          const avgResponseTime = responseTimes.length > 0 
            ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
            : 0;

          setDashboardMetrics({
            totalRuns: allRuns.length,
            successfulRuns,
            failedRuns,
            totalRequests,
            avgResponseTime,
            todayRuns: todayRuns.length,
            activeFlows: 0
          });
        }
        
      } catch (error) {
        console.warn('Kanal metrics API hatası:', error);
        
        // Hata durumunda SAVE_LOCAL verilerini kullan
        if (SAVE_LOCAL) {
          const allRuns = getAllRuns();
          const successfulRuns = allRuns.filter(run => run.data.status === 'completed').length;
          const failedRuns = allRuns.filter(run => run.data.status === 'error').length;
          
          setDashboardMetrics({
            totalRuns: allRuns.length,
            successfulRuns,
            failedRuns,
            totalRequests: allRuns.reduce((sum, run) => sum + (run.data.steps?.length || 0), 0),
            avgResponseTime: 0,
            todayRuns: allRuns.length,
            activeFlows: 0
          });
        }
      }
    };
    
    fetchKanalMetrics();
  }, [SAVE_LOCAL]);

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
      scenarios: scenarios, // Scenarios array'ini N8N'e gönder
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
        
      const res = await rateLimit.executeRequest(() => startFunction(payload));
      
      // RunKey'den başındaki = işaretini temizle
      const cleanRunKey = res.runKey?.replace(/^=+/, '') || res.runKey;
      console.log(`[KanalKontrolBotu] Original runKey: ${res.runKey}, Cleaned: ${cleanRunKey}`);
      
      setWizardOpen(false);
      
      // Test sonuçları sayfasına yönlendir
      const params = new URLSearchParams({
        runKey: cleanRunKey,
        flow: newFlow,
        isAllFlow: isAllFlow.toString(),
        wizardData: encodeURIComponent(JSON.stringify(wizardData))
      });
      
      navigate(`/test-results?${params.toString()}`);
    } catch (e) {
      alert("Start error: " + (e as Error).message);
    }
  }

  return (
    <div className="space-y-3 sm:space-y-4 px-4 sm:px-0">
      {/* Dashboard Header */}
      <div className="card p-3 sm:p-4">
        <h1 className="mb-2 text-lg sm:text-xl font-bold tracking-tight text-base-100">Kanal Kontrol Botu Dashboard</h1>
        <p className="text-sm leading-6 text-base-300">
          **Bot Performance Analytics** - Gerçek zamanlı metrikler, istatistikler ve akış durumu izleme.
        </p>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Toplam Koşu */}
        <div className="card p-3 bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-blue-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-300 uppercase tracking-wide">Toplam Koşu</p>
              <p className="text-xl font-bold text-blue-100">{dashboardMetrics.totalRuns}</p>
            </div>
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Başarılı Koşu */}
        <div className="card p-3 bg-gradient-to-br from-green-900/20 to-green-800/10 border-green-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-300 uppercase tracking-wide">Başarılı</p>
              <p className="text-xl font-bold text-green-100">{dashboardMetrics.successfulRuns}</p>
            </div>
            <div className="p-2 bg-green-500/20 rounded-lg">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Başarısız Koşu */}
        <div className="card p-3 bg-gradient-to-br from-red-900/20 to-red-800/10 border-red-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-300 uppercase tracking-wide">Başarısız</p>
              <p className="text-xl font-bold text-red-100">{dashboardMetrics.failedRuns}</p>
            </div>
            <div className="p-2 bg-red-500/20 rounded-lg">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Toplam İstek */}
        <div className="card p-3 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-purple-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-300 uppercase tracking-wide">Toplam İstek</p>
              <p className="text-xl font-bold text-purple-100">{dashboardMetrics.totalRequests}</p>
            </div>
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Ortalama Yanıt Süresi */}
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-base-300">Ortalama Yanıt Süresi</span>
            <div className="p-1 bg-amber-500/20 rounded">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-lg font-bold">
            {dashboardMetrics.avgResponseTime > 0 
              ? `${(dashboardMetrics.avgResponseTime / 1000).toFixed(1)}s` 
              : '-'
            }
          </p>
        </div>

        {/* Bugünkü Koşular */}
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-base-300">Bugünkü Koşular</span>
            <div className="p-1 bg-indigo-500/20 rounded">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <p className="text-lg font-bold">{dashboardMetrics.todayRuns}</p>
        </div>

        {/* Aktif Akışlar */}
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-base-300">Aktif Akışlar</span>
            <div className="p-1 bg-cyan-500/20 rounded">
              <div className={`w-2 h-2 rounded-full ${dashboardMetrics.activeFlows > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
            </div>
          </div>
          <p className="text-lg font-bold">{dashboardMetrics.activeFlows}</p>
        </div>
      </div>

      {/* Success Rate Chart */}
      <div className="card p-3 sm:p-4">
        <h3 className="text-base font-semibold mb-3">Başarı Oranı</h3>
        <div className="space-y-3">
          {/* Success Rate Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Başarılı İşlemler</span>
              <span>
                {dashboardMetrics.totalRuns > 0 
                  ? `${Math.round((dashboardMetrics.successfulRuns / dashboardMetrics.totalRuns) * 100)}%`
                  : '0%'
                }
              </span>
            </div>
            <div className="w-full bg-base-800 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full transition-all duration-500"
                style={{ 
                  width: dashboardMetrics.totalRuns > 0 
                    ? `${(dashboardMetrics.successfulRuns / dashboardMetrics.totalRuns) * 100}%` 
                    : '0%' 
                }}
              ></div>
            </div>
          </div>

          {/* Failure Rate Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Başarısız İşlemler</span>
              <span>
                {dashboardMetrics.totalRuns > 0 
                  ? `${Math.round((dashboardMetrics.failedRuns / dashboardMetrics.totalRuns) * 100)}%`
                  : '0%'
                }
              </span>
            </div>
            <div className="w-full bg-base-800 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-red-500 to-red-400 h-3 rounded-full transition-all duration-500"
                style={{ 
                  width: dashboardMetrics.totalRuns > 0 
                    ? `${(dashboardMetrics.failedRuns / dashboardMetrics.totalRuns) * 100}%` 
                    : '0%' 
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-3 sm:p-4">
        <h3 className="text-base font-semibold mb-3">Hızlı İşlemler</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <button
            className="btn w-full sm:w-auto"
            onClick={() => setWizardOpen(true)}
            disabled={!rateLimit.canMakeRequest}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Yeni Test Başlat
          </button>
          
          {!rateLimit.canMakeRequest && (
            <div className="w-full sm:flex-1 sm:max-w-xs">
              <RateLimitProgress remainingTime={rateLimit.remainingTime} />
            </div>
          )}
        </div>
      </div>

      {/* Yeni Wizard Modal */}
      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title="Test Sihirbazı">
        <Wizard onComplete={onWizardComplete} onCancel={() => setWizardOpen(false)} />
      </Modal>
    </div>
  );
}
