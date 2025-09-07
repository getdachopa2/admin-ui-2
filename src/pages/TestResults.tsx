// src/pages/TestResults.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { IndeterminateBar, SolidProgress } from "@/components/ProgressBar";
import { useProgress } from "@/hooks/useProgress";
import LiveSteps from "@/components/LiveSteps";
import TestSummaryReport from "@/components/TestSummaryReport";
import { saveRun, type SavedRun } from "@/lib/runsStore";

export default function TestResults() {
  const SAVE_LOCAL = import.meta.env.VITE_SAVE_LOCAL_RUNS === "true";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const runKey = searchParams.get('runKey');
  const currentFlow = (searchParams.get('flow') as 'payment' | 'cancelRefund' | 'bankRegression') || 'payment';
  const isAllFlow = searchParams.get('isAllFlow') === 'true';
  const rawWizardData = searchParams.get('wizardData');
  
  // Wizard data'sını parse et
  const lastWizardData = rawWizardData ? JSON.parse(decodeURIComponent(rawWizardData)) : null;

  const [steps, setSteps] = useState<any[]>([]);
  
  // Payment başarısında cancel/refund işlemini başlat
  const handlePaymentSuccess = React.useCallback(async (newRunKey?: string) => {
    if (!isAllFlow) return;
    
    if (newRunKey) {
      // NewRunKey'den başındaki = işaretini temizle
      const cleanNewRunKey = newRunKey.replace(/^=+/, '');
      console.log(`[TestResults] Payment success, switching to cancel/refund flow. Original: ${newRunKey}, Cleaned: ${cleanNewRunKey}`);
      
      // URL'i güncelle - flow'u cancelRefund'a çevir
      const newParams = new URLSearchParams(searchParams);
      newParams.set('runKey', cleanNewRunKey);
      newParams.set('flow', 'cancelRefund');
      navigate(`/test-results?${newParams.toString()}`, { replace: true });
    } else {
      console.log('[TestResults] Payment success but no new runKey found');
    }
  }, [isAllFlow, searchParams, navigate]);

  const { data: prog, error: progErr } = useProgress({ 
    runKey, 
    flow: currentFlow, 
    switchToCancelAfterPayment: isAllFlow,
    onPaymentSuccess: handlePaymentSuccess
  });

  const running = prog?.status === "running";
  const progressSteps = prog?.steps ?? [];

  // Akış türüne göre tamamlanma kontrolü
  const isCompleted = React.useMemo(() => {
    if (!prog || running) return false;
    
    // Status-based kontrol
    if (prog.status === 'completed' || prog.status === 'error') return true;
    
    // Content-based kontrol: son adımda terminal kelimeler var mı?
    if (progressSteps.length > 0) {
      const lastStep = progressSteps[progressSteps.length - 1];
      const content = `${lastStep.name || ''} ${lastStep.message || ''}`.toLowerCase();
      
      if (currentFlow === 'cancelRefund') {
        // Cancel/Refund akışı için spesifik terminal kelimeler
        return /cancel.*success|iptal.*başar|refund.*success|iade.*başar|işlem.*tamamlan|final.*rapor/i.test(content);
      } else if (currentFlow === 'bankRegression') {
        // Bank Regression akışı için spesifik terminal kelimeler
        return /regression.*complete|bank.*test.*complete|regresyon.*tamamlan|banka.*test.*tamamlan|test.*tamamlandı|final.*rapor|report.*final|all.*banks.*tested|tüm.*bankalar.*test|done/i.test(content);
      } else {
        // Payment akışı için genel terminal kelimeler
        return /payment.*success|ödeme.*başar|işlem.*tamamlan|final.*rapor|tamamlan/i.test(content);
      }
    }
    
    return false;
  }, [prog, running, progressSteps, currentFlow]);

  // Ticker: sunucudan event gelmeden hemen görünsün diye ilk yerel step
  const [echoSteps, setEchoSteps] = useState<
    Array<{ time: string; name: string; status: string; message?: string }>
  >([]);

  const liveSteps = React.useMemo(() => [...echoSteps, ...progressSteps], [echoSteps, progressSteps]);
  const listSteps = React.useMemo(() => (running ? liveSteps : progressSteps), [running, liveSteps, progressSteps]);

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

  // HTML Export fonksiyonu - Tam expanded sayfa raporu
  const exportToHTML = () => {
    // Test Summary Report bileşeninden verileri al
    const groupStepsByType = (steps: any[]) => {
      // Hazırlık adımlarını filtrele
      const filteredSteps = steps.filter(step => {
        const name = step.name?.toLowerCase() || '';
        const message = step.message?.toLowerCase() || '';
        const combinedText = `${name} ${message}`;
        
        return !(
          combinedText.includes('hazır') ||
          combinedText.includes('ready') ||
          combinedText.includes('soap hazır')
        );
      });

      return {
        tokenAlma: filteredSteps.filter(step => {
          const name = step.name?.toLowerCase() || '';
          const message = step.message?.toLowerCase() || '';
          return name.includes('token') || message.includes('token');
        }),
        odeme: filteredSteps.filter(step => {
          const name = step.name?.toLowerCase() || '';
          const message = step.message?.toLowerCase() || '';
          return (name.includes('ödeme') || name.includes('payment') || 
                  message.includes('ödeme') || message.includes('payment')) &&
                 !name.includes('iptal') && !name.includes('cancel') &&
                 !name.includes('iade') && !name.includes('refund');
        }),
        iptal: filteredSteps.filter(step => {
          const name = step.name?.toLowerCase() || '';
          const message = step.message?.toLowerCase() || '';
          return name.includes('iptal') || name.includes('cancel') ||
                 message.includes('iptal') || message.includes('cancel');
        }),
        iade: filteredSteps.filter(step => {
          const name = step.name?.toLowerCase() || '';
          const message = step.message?.toLowerCase() || '';
          return name.includes('iade') || name.includes('refund') ||
                 message.includes('iade') || message.includes('refund');
        })
      };
    };

    const groupedSteps = groupStepsByType(listSteps);
    
    // XML/JSON formatting fonksiyonu
    const formatRequestResponse = (content: string) => {
      if (!content) return '';
      
      try {
        // SOAP XML ise sadece body'i al ve formatla
        if (content.includes('soap:Envelope') || content.includes('<soapenv:')) {
          const bodyMatch = content.match(/<(?:soap|soapenv):Body[^>]*>(.*?)<\/(?:soap|soapenv):Body>/s);
          if (bodyMatch) {
            let bodyContent = bodyMatch[1].trim();
            // XML formatla
            bodyContent = bodyContent
              .replace(/></g, '>\n<')
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .map((line, index, arr) => {
                const depth = Math.max(0, (line.match(/</g) || []).length - (line.match(/\//g) || []).length);
                return '  '.repeat(depth) + line;
              })
              .join('\n');
            return bodyContent;
          }
        }
        
        // JSON ise formatla
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return content;
      }
    };

    // Filtrelenmiş adımlar
    const filteredSteps = listSteps.filter(step => {
      const name = step.name?.toLowerCase() || '';
      const message = step.message?.toLowerCase() || '';
      const combinedText = `${name} ${message}`;
      
      return !(
        combinedText.includes('hazır') ||
        combinedText.includes('ready') ||
        combinedText.includes('soap hazır')
      );
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Raporu - ${runKey}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #0a0a0a; 
            color: #f5f5f5; 
            line-height: 1.6;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        
        /* Header */
        .header { 
            background: linear-gradient(135deg, #1e293b, #334155); 
            padding: 30px; 
            border-radius: 16px; 
            margin-bottom: 30px;
            border: 1px solid #334155;
        }
        .title { font-size: 32px; font-weight: bold; margin-bottom: 12px; color: #f1f5f9; }
        .subtitle { color: #94a3b8; font-size: 16px; }
        
        /* Cards */
        .card { 
            background: rgba(23, 23, 23, 0.6); 
            border: 1px solid #262626; 
            border-radius: 16px; 
            padding: 24px; 
            margin-bottom: 24px; 
        }
        .card h2 { font-size: 24px; margin-bottom: 20px; color: #f1f5f9; }
        .card h3 { font-size: 20px; margin-bottom: 16px; color: #e2e8f0; }
        
        /* Test Özeti */
        .test-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .summary-item { background: rgba(31, 41, 55, 0.5); padding: 16px; border-radius: 12px; border: 1px solid #374151; }
        .summary-label { font-size: 14px; color: #9ca3af; margin-bottom: 4px; }
        .summary-value { font-size: 16px; font-weight: 600; color: #f9fafb; }
        
        /* Status */
        .status-success { color: #22c55e; }
        .status-error { color: #ef4444; }
        .status-pending { color: #f59e0b; }
        .status-running { color: #3b82f6; }
        
        /* Live Steps */
        .live-steps { margin-bottom: 24px; }
        .step-item { 
            background: rgba(31, 41, 55, 0.3); 
            border: 1px solid #374151; 
            border-radius: 12px; 
            padding: 16px; 
            margin-bottom: 12px;
            position: relative;
            padding-left: 48px;
        }
        .step-item::before {
            content: '';
            position: absolute;
            left: 20px;
            top: 20px;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
        }
        .step-header { display: flex; justify-content: between; align-items: center; margin-bottom: 8px; }
        .step-name { font-weight: 600; color: #f9fafb; font-size: 16px; }
        .step-time { color: #6b7280; font-size: 14px; }
        .step-message { color: #d1d5db; font-size: 14px; margin-top: 8px; }
        
        /* Test Summary Report */
        .summary-report { margin-top: 24px; }
        .category-section { margin-bottom: 32px; }
        .category-header { 
            background: linear-gradient(135deg, #1f2937, #374151); 
            padding: 20px; 
            border-radius: 12px; 
            margin-bottom: 16px; 
            cursor: pointer;
            border: 1px solid #4b5563;
        }
        .category-title { font-size: 20px; font-weight: 600; color: #f9fafb; }
        .category-count { font-size: 14px; color: #9ca3af; margin-top: 4px; }
        
        .step-details { background: rgba(17, 24, 39, 0.8); border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #374151; }
        .step-detail-header { margin-bottom: 16px; }
        .step-detail-name { font-size: 18px; font-weight: 600; color: #f9fafb; margin-bottom: 4px; }
        .step-detail-time { font-size: 14px; color: #6b7280; }
        .step-detail-message { font-size: 16px; color: #d1d5db; margin-bottom: 16px; }
        
        .request-response { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 768px) {
            .request-response { grid-template-columns: 1fr 1fr; }
        }
        
        .code-section { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; overflow: hidden; }
        .code-header { 
            background: #1e293b; 
            padding: 12px 16px; 
            font-size: 14px; 
            font-weight: 600; 
            color: #f1f5f9;
            border-bottom: 1px solid #334155;
        }
        .code-content { 
            padding: 16px; 
            font-family: 'Courier New', 'Consolas', monospace; 
            font-size: 12px; 
            white-space: pre-wrap; 
            overflow: auto;
            max-height: 400px;
            color: #e2e8f0;
        }
        
        /* Stats */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px; }
        .stat-card { background: rgba(31, 41, 55, 0.5); padding: 20px; border-radius: 12px; border: 1px solid #374151; text-align: center; }
        .stat-number { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
        .stat-label { font-size: 14px; color: #9ca3af; }
        
        /* Print styles */
        @media print {
            body { background: white; color: black; }
            .card { background: white; border: 1px solid #ddd; }
            .header { background: #f8f9fa; color: black; }
            .code-section { background: #f8f9fa; }
            .step-item { background: #f8f9fa; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="title">Kanal Kontrol Botu - Test Raporu</div>
            <div class="subtitle">
                Run Key: ${runKey} | 
                Akış: ${currentFlow === 'cancelRefund' ? 'Cancel/Refund' : 'Payment'} | 
                Tarih: ${new Date().toLocaleString('tr-TR')}
            </div>
        </div>
        
        <!-- Test Özeti -->
        <div class="card">
            <h2>📊 Test Özeti</h2>
            <div class="test-summary">
                <div class="summary-item">
                    <div class="summary-label">Senaryo</div>
                    <div class="summary-value">${lastWizardData?.scenarios?.join(', ') || 'Belirtilmemiş'}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Ortam</div>
                    <div class="summary-value">${lastWizardData?.env || 'Belirtilmemiş'}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Kanal</div>
                    <div class="summary-value">${lastWizardData?.channelId || 'Belirtilmemiş'}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Uygulama</div>
                    <div class="summary-value">${lastWizardData?.application?.applicationName || 'Belirtilmemiş'}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Durum</div>
                    <div class="summary-value status-${isCompleted ? 'success' : running ? 'running' : 'pending'}">
                        ${isCompleted ? '✅ Tamamlandı' : running ? '🔄 Devam Ediyor' : '⏳ Beklemede'}
                    </div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Toplam Adım</div>
                    <div class="summary-value">${filteredSteps.length}</div>
                </div>
            </div>
        </div>
        
        <!-- İstatistikler -->
        <div class="card">
            <h2>📈 İstatistikler</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number status-success">${groupedSteps.tokenAlma.length}</div>
                    <div class="stat-label">Token Alma</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number status-success">${groupedSteps.odeme.length}</div>
                    <div class="stat-label">Ödeme İşlemleri</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number status-error">${groupedSteps.iptal.length}</div>
                    <div class="stat-label">İptal İşlemleri</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number status-pending">${groupedSteps.iade.length}</div>
                    <div class="stat-label">İade İşlemleri</div>
                </div>
            </div>
        </div>
        
        <!-- Canlı Adımlar -->
        <div class="card">
            <h2>🔄 Test Adımları</h2>
            <div class="live-steps">
                ${filteredSteps.map((step, index) => `
                    <div class="step-item">
                        <div class="step-header">
                            <span class="step-name">${index + 1}. ${step.name || 'Adım'}</span>
                            <span class="step-time">${step.time || ''}</span>
                        </div>
                        ${step.message ? `<div class="step-message">${step.message}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        
        <!-- Detaylı Test Raporu -->
        ${isCompleted ? `
        <div class="card summary-report">
            <h2>📋 Detaylı Test Raporu</h2>
            
            <!-- Token Alma -->
            ${groupedSteps.tokenAlma.length > 0 ? `
            <div class="category-section">
                <div class="category-header">
                    <div class="category-title">🔑 Token Alma Süreci</div>
                    <div class="category-count">${groupedSteps.tokenAlma.length} adım</div>
                </div>
                ${groupedSteps.tokenAlma.map(step => `
                    <div class="step-details">
                        <div class="step-detail-header">
                            <div class="step-detail-name">${step.name || 'Adım'}</div>
                            <div class="step-detail-time">${step.time || ''}</div>
                        </div>
                        ${step.message ? `<div class="step-detail-message">${step.message}</div>` : ''}
                        ${step.request || step.response ? `
                            <div class="request-response">
                                ${step.request ? `
                                    <div class="code-section">
                                        <div class="code-header">📤 İstek</div>
                                        <div class="code-content">${formatRequestResponse(typeof step.request === 'string' ? step.request : JSON.stringify(step.request, null, 2))}</div>
                                    </div>
                                ` : ''}
                                ${step.response ? `
                                    <div class="code-section">
                                        <div class="code-header">📥 Yanıt</div>
                                        <div class="code-content">${formatRequestResponse(typeof step.response === 'string' ? step.response : JSON.stringify(step.response, null, 2))}</div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <!-- Ödeme İşlemleri -->
            ${groupedSteps.odeme.length > 0 ? `
            <div class="category-section">
                <div class="category-header">
                    <div class="category-title">💳 Ödeme İşlemleri</div>
                    <div class="category-count">${groupedSteps.odeme.length} adım</div>
                </div>
                ${groupedSteps.odeme.map(step => `
                    <div class="step-details">
                        <div class="step-detail-header">
                            <div class="step-detail-name">${step.name || 'Adım'}</div>
                            <div class="step-detail-time">${step.time || ''}</div>
                        </div>
                        ${step.message ? `<div class="step-detail-message">${step.message}</div>` : ''}
                        ${step.request || step.response ? `
                            <div class="request-response">
                                ${step.request ? `
                                    <div class="code-section">
                                        <div class="code-header">📤 İstek</div>
                                        <div class="code-content">${formatRequestResponse(typeof step.request === 'string' ? step.request : JSON.stringify(step.request, null, 2))}</div>
                                    </div>
                                ` : ''}
                                ${step.response ? `
                                    <div class="code-section">
                                        <div class="code-header">📥 Yanıt</div>
                                        <div class="code-content">${formatRequestResponse(typeof step.response === 'string' ? step.response : JSON.stringify(step.response, null, 2))}</div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <!-- İptal İşlemleri -->
            ${groupedSteps.iptal.length > 0 ? `
            <div class="category-section">
                <div class="category-header">
                    <div class="category-title">❌ İptal İşlemleri</div>
                    <div class="category-count">${groupedSteps.iptal.length} adım</div>
                </div>
                ${groupedSteps.iptal.map(step => `
                    <div class="step-details">
                        <div class="step-detail-header">
                            <div class="step-detail-name">${step.name || 'Adım'}</div>
                            <div class="step-detail-time">${step.time || ''}</div>
                        </div>
                        ${step.message ? `<div class="step-detail-message">${step.message}</div>` : ''}
                        ${step.request || step.response ? `
                            <div class="request-response">
                                ${step.request ? `
                                    <div class="code-section">
                                        <div class="code-header">📤 İstek</div>
                                        <div class="code-content">${formatRequestResponse(typeof step.request === 'string' ? step.request : JSON.stringify(step.request, null, 2))}</div>
                                    </div>
                                ` : ''}
                                ${step.response ? `
                                    <div class="code-section">
                                        <div class="code-header">📥 Yanıt</div>
                                        <div class="code-content">${formatRequestResponse(typeof step.response === 'string' ? step.response : JSON.stringify(step.response, null, 2))}</div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            <!-- İade İşlemleri -->
            ${groupedSteps.iade.length > 0 ? `
            <div class="category-section">
                <div class="category-header">
                    <div class="category-title">💰 İade İşlemleri</div>
                    <div class="category-count">${groupedSteps.iade.length} adım</div>
                </div>
                ${groupedSteps.iade.map(step => `
                    <div class="step-details">
                        <div class="step-detail-header">
                            <div class="step-detail-name">${step.name || 'Adım'}</div>
                            <div class="step-detail-time">${step.time || ''}</div>
                        </div>
                        ${step.message ? `<div class="step-detail-message">${step.message}</div>` : ''}
                        ${step.request || step.response ? `
                            <div class="request-response">
                                ${step.request ? `
                                    <div class="code-section">
                                        <div class="code-header">📤 İstek</div>
                                        <div class="code-content">${formatRequestResponse(typeof step.request === 'string' ? step.request : JSON.stringify(step.request, null, 2))}</div>
                                    </div>
                                ` : ''}
                                ${step.response ? `
                                    <div class="code-section">
                                        <div class="code-header">📥 Yanıt</div>
                                        <div class="code-content">${formatRequestResponse(typeof step.response === 'string' ? step.response : JSON.stringify(step.response, null, 2))}</div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
        ` : ''}
        
        <!-- Footer -->
        <div class="card" style="text-align: center; margin-top: 40px;">
            <p style="color: #6b7280; font-size: 14px;">
                Bu rapor Kanal Kontrol Botu tarafından ${new Date().toLocaleString('tr-TR')} tarihinde oluşturulmuştur.
            </p>
        </div>
    </div>
</body>
</html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-raporu-${runKey}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // PDF Export fonksiyonu
  const exportToPDF = async () => {
    try {
      // Dinamik import jsPDF ve html2canvas
      const [jsPDF, html2canvas] = await Promise.all([
        import('jspdf').then(m => m.default),
        import('html2canvas').then(m => m.default)
      ]);

      // Test Summary Report bileşeninden verileri al
      const groupStepsByType = (steps: any[]) => {
        // Hazırlık adımlarını filtrele
        const filteredSteps = steps.filter(step => {
          const name = step.name?.toLowerCase() || '';
          const message = step.message?.toLowerCase() || '';
          const combinedText = `${name} ${message}`;
          
          return !(
            combinedText.includes('hazır') ||
            combinedText.includes('ready') ||
            combinedText.includes('soap hazır')
          );
        });

        return {
          tokenAlma: filteredSteps.filter(step => {
            const name = step.name?.toLowerCase() || '';
            const message = step.message?.toLowerCase() || '';
            return name.includes('token') || message.includes('token');
          }),
          odeme: filteredSteps.filter(step => {
            const name = step.name?.toLowerCase() || '';
            const message = step.message?.toLowerCase() || '';
            return (name.includes('ödeme') || name.includes('payment') || 
                    message.includes('ödeme') || message.includes('payment')) &&
                   !name.includes('iptal') && !name.includes('cancel') &&
                   !name.includes('iade') && !name.includes('refund');
          }),
          iptal: filteredSteps.filter(step => {
            const name = step.name?.toLowerCase() || '';
            const message = step.message?.toLowerCase() || '';
            return name.includes('iptal') || name.includes('cancel') ||
                   message.includes('iptal') || message.includes('cancel');
          }),
          iade: filteredSteps.filter(step => {
            const name = step.name?.toLowerCase() || '';
            const message = step.message?.toLowerCase() || '';
            return name.includes('iade') || name.includes('refund') ||
                   message.includes('iade') || message.includes('refund');
          })
        };
      };

      // Geçici bir HTML container oluştur
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.width = '1200px';
      tempDiv.style.background = 'white';
      tempDiv.style.color = 'black';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.padding = '20px';

      // HTML içeriğini oluştur (PDF için optimize edilmiş)
      const groupedSteps = groupStepsByType(listSteps);
      const filteredSteps = listSteps.filter(step => {
        const name = step.name?.toLowerCase() || '';
        const message = step.message?.toLowerCase() || '';
        const combinedText = `${name} ${message}`;
        
        return !(
          combinedText.includes('hazır') ||
          combinedText.includes('ready') ||
          combinedText.includes('soap hazır')
        );
      });

      const formatRequestResponse = (content: string) => {
        if (!content) return '';
        
        try {
          // SOAP XML ise sadece body'i al
          if (content.includes('soap:Envelope') || content.includes('<soapenv:')) {
            const bodyMatch = content.match(/<(?:soap|soapenv):Body[^>]*>(.*?)<\/(?:soap|soapenv):Body>/s);
            if (bodyMatch) {
              return bodyMatch[1].trim().substring(0, 500) + '...'; // PDF için kısalt
            }
          }
          
          // JSON ise formatla ve kısalt
          const parsed = JSON.parse(content);
          const formatted = JSON.stringify(parsed, null, 2);
          return formatted.length > 500 ? formatted.substring(0, 500) + '...' : formatted;
        } catch {
          return content.length > 500 ? content.substring(0, 500) + '...' : content;
        }
      };

      tempDiv.innerHTML = `
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: black; line-height: 1.4; }
          .header { border-bottom: 2px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
          .subtitle { color: #666; font-size: 14px; }
          .section { margin-bottom: 20px; page-break-inside: avoid; }
          .section h2 { font-size: 18px; margin-bottom: 12px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          .section h3 { font-size: 16px; margin-bottom: 8px; color: #444; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
          .summary-item { border: 1px solid #ddd; padding: 12px; border-radius: 4px; }
          .summary-label { font-size: 12px; color: #666; margin-bottom: 4px; }
          .summary-value { font-size: 14px; font-weight: 600; }
          .step-item { border: 1px solid #eee; padding: 12px; margin-bottom: 8px; border-radius: 4px; }
          .step-header { font-weight: 600; margin-bottom: 4px; }
          .step-message { font-size: 12px; color: #666; }
          .code-block { background: #f5f5f5; border: 1px solid #ddd; padding: 8px; font-family: monospace; font-size: 10px; margin: 8px 0; white-space: pre-wrap; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .stat-card { text-align: center; border: 1px solid #ddd; padding: 12px; border-radius: 4px; }
          .stat-number { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
          .stat-label { font-size: 12px; color: #666; }
        </style>
        
        <div class="header">
          <div class="title">Kanal Kontrol Botu - Test Raporu</div>
          <div class="subtitle">Run Key: ${runKey} | Akış: ${currentFlow === 'cancelRefund' ? 'Cancel/Refund' : 'Payment'} | ${new Date().toLocaleString('tr-TR')}</div>
        </div>
        
        <div class="section">
          <h2>Test Özeti</h2>
          <div class="grid">
            <div class="summary-item">
              <div class="summary-label">Senaryo</div>
              <div class="summary-value">${lastWizardData?.scenarios?.join(', ') || 'Belirtilmemiş'}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Ortam</div>
              <div class="summary-value">${lastWizardData?.env || 'Belirtilmemiş'}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Durum</div>
              <div class="summary-value">${isCompleted ? 'Tamamlandı' : running ? 'Devam Ediyor' : 'Beklemede'}</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>İstatistikler</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">${groupedSteps.tokenAlma.length}</div>
              <div class="stat-label">Token Alma</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${groupedSteps.odeme.length}</div>
              <div class="stat-label">Ödeme</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${groupedSteps.iptal.length}</div>
              <div class="stat-label">İptal</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${groupedSteps.iade.length}</div>
              <div class="stat-label">İade</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Test Adımları (${filteredSteps.length} adım)</h2>
          ${filteredSteps.slice(0, 10).map((step, index) => `
            <div class="step-item">
              <div class="step-header">${index + 1}. ${step.name || 'Adım'} ${step.time ? `(${step.time})` : ''}</div>
              ${step.message ? `<div class="step-message">${step.message.length > 100 ? step.message.substring(0, 100) + '...' : step.message}</div>` : ''}
            </div>
          `).join('')}
          ${filteredSteps.length > 10 ? `<p style="color: #666; font-style: italic;">... ve ${filteredSteps.length - 10} adım daha</p>` : ''}
        </div>
        
        ${isCompleted && groupedSteps.odeme.length > 0 ? `
        <div class="section">
          <h2>Ödeme İşlemleri Detayı</h2>
          ${groupedSteps.odeme.slice(0, 3).map(step => `
            <div class="step-item">
              <div class="step-header">${step.name || 'Adım'}</div>
              ${step.message ? `<div class="step-message">${step.message}</div>` : ''}
              ${step.request ? `
                <div style="margin-top: 8px;">
                  <strong>İstek:</strong>
                  <div class="code-block">${formatRequestResponse(typeof step.request === 'string' ? step.request : JSON.stringify(step.request))}</div>
                </div>
              ` : ''}
              ${step.response ? `
                <div style="margin-top: 8px;">
                  <strong>Yanıt:</strong>
                  <div class="code-block">${formatRequestResponse(typeof step.response === 'string' ? step.response : JSON.stringify(step.response))}</div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
      `;

      document.body.appendChild(tempDiv);

      // Canvas'a dönüştür
      const canvas = await html2canvas(tempDiv, {
        useCORS: true,
        allowTaint: true,
        scale: 1,
        width: 1200,
        backgroundColor: 'white'
      });

      // Temp div'i kaldır
      document.body.removeChild(tempDiv);

      // PDF oluştur
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      // PDF'i indir
      pdf.save(`test-raporu-${runKey}-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF oluşturulurken bir hata oluştu. HTML export\'u deneyin.');
    }
  };

  if (!runKey) {
    return (
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div className="card p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Test Sonuçları</h1>
          <p className="text-base-300 mb-6">Geçerli bir test runKey'i bulunamadı.</p>
          <button 
            className="btn" 
            onClick={() => navigate('/kanal-kontrol-botu')}
          >
            Dashboard'a Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-base-100 mb-2">
              {currentFlow === 'bankRegression' ? (
                <>
                  <i className="fas fa-university mr-2"></i>
                  Banka Regresyon Test Sonuçları
                </>
              ) : (
                'Test Sonuçları'
              )}
            </h1>
            <div className="text-sm text-base-400 break-all sm:break-normal">
              Run Key: <code className="rounded bg-base-800 px-1 text-base-100">{runKey}</code>
              {currentFlow === 'bankRegression' && lastWizardData && (
                <div className="mt-1">
                  <span className="text-orange-400">
                    {lastWizardData.selectedBanks?.length} banka • {lastWizardData.scenario} • {lastWizardData.environment}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => navigate(currentFlow === 'bankRegression' ? '/banka-regression-botu' : '/kanal-kontrol-botu')}
            >
              Dashboard'a Dön
            </button>
            {isCompleted && (
              <>
                <button 
                  className="btn btn-sm"
                  onClick={exportToHTML}
                  style={{ marginRight: '8px' }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  HTML İndir
                </button>
                <button 
                  className="btn btn-sm"
                  onClick={exportToPDF}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  PDF İndir
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Panel */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${running ? 'bg-amber-500/20' : isCompleted ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
            {running ? (
              <svg className="w-5 h-5 text-amber-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : isCompleted ? (
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              {running ? 'Aktif Test Koşusu' : isCompleted ? 'Test Tamamlandı' : 'Test Beklemede'}
            </h3>
            <p className="text-sm text-base-400">
              {currentFlow === 'cancelRefund' ? 'Cancel/Refund Akışı' : 'Payment Akışı'}
            </p>
          </div>
          <div className="w-full sm:w-56 flex-shrink-0">
            {running ? (
              <IndeterminateBar message="Koşu devam ediyor..." />
            ) : isCompleted ? (
              <SolidProgress 
                value={100} 
                message="Tamamlandı" 
              />
            ) : (
              <SolidProgress value={0} message="Bekliyor..." />
            )}
          </div>
        </div>
        
        {progErr && <div className="mt-4 text-sm text-red-400">Hata: {progErr}</div>}
      </div>

      {/* Canlı Adımlar */}
      <div className="card p-4 sm:p-6">
        <h3 className="text-lg font-semibold mb-4">Canlı Adımlar</h3>
        <LiveSteps steps={listSteps} isRunning={running} />
      </div>

      {/* Detaylı Test Raporu - Sadece test tamamlandığında */}
      {isCompleted && (
        <TestSummaryReport 
          steps={listSteps}
          testSummary={lastWizardData ? {
            scenario: lastWizardData.scenarios?.join(', ') || undefined,
            environment: lastWizardData.env || undefined,
            channel: lastWizardData.channelId || undefined,
            application: lastWizardData.application?.applicationName || undefined,
            cards: lastWizardData.cardSelectionMode === 'manual' 
              ? lastWizardData.manualCards || []
              : undefined,
            cancelRefund: lastWizardData.cancelRefund ? [lastWizardData.cancelRefund] : undefined
          } : undefined}
          currentFlow={currentFlow}
          isCompleted={isCompleted}
        />
      )}
    </div>
  );
}
