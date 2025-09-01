// src/components/DetailedTestReport.tsx
import { useState } from 'react';
import CodeBlock from './CodeBlock';
import { usePDFExport } from '../hooks/usePDFExport';

interface TestStep {
  id: string;
  type: 'token' | 'payment' | 'cancel' | 'refund';
  cardNumber?: string;
  paymentId?: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
  request?: any;
  response?: any;
  message?: string;
}

// N8N'den gelen step formatı
interface N8NStep {
  time: string;
  name: string;
  status: string;
  message?: string;
  request?: any;
  response?: any;
}

// Union type: Ya TestStep ya da N8NStep olabilir
type StepData = TestStep | N8NStep;

interface DetailedTestReportProps {
  steps: StepData[];
  testSummary?: {
    scenario?: string;
    environment?: string;
    channel?: string;
    application?: string;
    cards?: any[];
    cancelRefund?: any[];
  };
}

// Type guard: N8NStep olup olmadığını kontrol eder
function isN8NStep(step: StepData): step is N8NStep {
  return 'time' in step && 'name' in step && !('id' in step);
}

// N8NStep'i TestStep formatına dönüştürür
function convertN8NStepToTestStep(step: N8NStep, index: number): TestStep {
  const id = `n8n-${index}`;
  const timestamp = step.time;
  
  // Step name ve request/response'dan type'ı ve diğer bilgileri çıkar
  let type: 'token' | 'payment' | 'cancel' | 'refund' = 'payment';
  const name = step.name.toLowerCase();
  
  if (name.includes('token') || (step.request && step.request.cardNumber)) {
    type = 'token';
  } else if (name.includes('cancel') || name.includes('iptal')) {
    type = 'cancel';
  } else if (name.includes('refund') || name.includes('iade')) {
    type = 'refund';
  } else if (name.includes('payment') || name.includes('ödeme') || (step.request && step.request.amount)) {
    type = 'payment';
  }
  
  // Status mapping
  let status: 'success' | 'error' | 'pending' = 'pending';
  const stepStatus = step.status.toLowerCase();
  
  if (stepStatus === 'running' || stepStatus === 'completed' || stepStatus === 'success') {
    status = 'success';
  } else if (stepStatus === 'failed' || stepStatus === 'error') {
    status = 'error';
  }
  
  // Request/response'dan kart numarası ve payment ID çıkar
  let cardNumber: string | undefined;
  let paymentId: string | undefined;
  
  if (step.request) {
    // Token işlemi için kart numarası
    if (step.request.cardNumber) {
      cardNumber = step.request.cardNumber;
    }
    // Payment işlemi için token'dan kart numarası çıkarmaya çalış
    if (step.request.token && step.response?.maskedCard) {
      cardNumber = step.response.maskedCard.replace('*', '').replace(/\*/g, '');
    }
  }
  
  if (step.response) {
    // Payment ID'yi response'dan al
    if (step.response.paymentId) {
      paymentId = step.response.paymentId;
    }
    // Masked card varsa kullan
    if (step.response.maskedCard && !cardNumber) {
      cardNumber = step.response.maskedCard;
    }
  }
  
  return {
    id,
    type,
    timestamp,
    status,
    message: step.message || step.name,
    request: step.request,
    response: step.response,
    cardNumber,
    paymentId,
  };
}

export default function DetailedTestReport({ steps, testSummary }: DetailedTestReportProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const { exportToPDF, isExporting } = usePDFExport();

  const handleExportPDF = async () => {
    try {
      console.log('PDF export başlatılıyor...');
      console.log('Test summary:', testSummary);
      console.log('Normalized steps:', normalizedSteps.length, 'adet');
      
      await exportToPDF('detailed-test-report', {
        title: 'Kanal Kontrol Bot - Test Raporu',
        filename: 'kanal-kontrol-test-raporu',
        includeTimestamp: true,
        testSummary,
        testSteps: normalizedSteps
      });
      
      console.log('PDF export başarılı!');
    } catch (error) {
      console.error('PDF export hatası detayı:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Daha detaylı hata mesajı
      let errorMessage = 'PDF export sırasında hata oluştu.';
      if (error instanceof Error) {
        errorMessage += ` Hata: ${error.message}`;
      }
      
      alert(errorMessage + ' Lütfen browser console\'unu kontrol edin.');
    }
  };

  // N8N step'leri varsa onları dönüştür, yoksa olduğu gibi kullan
  const normalizedSteps: TestStep[] = steps
    .filter(step => {
      // Sadece anlamlı step'leri filtrele
      if (isN8NStep(step)) {
        const name = step.name.toLowerCase();
        // Workflow başlatma, tamamlama gibi genel step'leri filtrele
        if (name.includes('başlat') || name.includes('start') || 
            name.includes('tamamla') || name.includes('complete') ||
            name.includes('akış') || name.includes('workflow') ||
            !step.request && !step.response) {
          return false;
        }
      }
      return true;
    })
    .map((step, index) => 
      isN8NStep(step) ? convertN8NStepToTestStep(step, index) : step
    );

  // Benzer step'leri birleştir (aynı type ve aynı card/payment için)
  const mergedSteps = normalizedSteps.reduce((acc, step) => {
    const existingIndex = acc.findIndex(existing => 
      existing.type === step.type && 
      existing.cardNumber === step.cardNumber &&
      existing.paymentId === step.paymentId
    );
    
    if (existingIndex >= 0) {
      // Eğer aynı türde step varsa, en son olan step'i kullan (daha güncel veri)
      if (new Date(step.timestamp) > new Date(acc[existingIndex].timestamp)) {
        acc[existingIndex] = step;
      }
    } else {
      acc.push(step);
    }
    
    return acc;
  }, [] as TestStep[]);

  // Group steps only by type, remove card/payment sub-grouping
  const groupedSteps = mergedSteps.reduce((acc, step) => {
    const typeKey = step.type;
    
    if (!acc[typeKey]) {
      acc[typeKey] = [];
    }
    
    acc[typeKey].push(step);
    return acc;
  }, {} as Record<string, TestStep[]>);

  const toggleType = (type: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-emerald-400 bg-emerald-500/10';
      case 'error': return 'text-red-400 bg-red-500/10';
      default: return 'text-amber-400 bg-amber-500/10';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'token': return 'Token Alma';
      case 'payment': return 'Ödeme';
      case 'cancel': return 'İptal';
      case 'refund': return 'İade';
      default: return type;
    }
  };

  const formatIdentifier = (type: string, identifier: string) => {
    // Otomatik oluşturulan identifier'ları temizle
    if (identifier.startsWith('Card-') || identifier.startsWith('Payment-')) {
      const parts = identifier.split('-');
      if (parts.length >= 3) {
        // "Card-n8n-1" -> "Kart #1", "Payment-n8n-6" -> "Payment #6"
        const number = parts[parts.length - 1];
        return type === 'token' || type === 'payment' ? `Kart #${number}` : `Payment #${number}`;
      }
    }
    
    // Sadece kart numaraları için maskeleme yap, diğer önemli bilgiler (orderID, paymentID) tam gösterilsin
    if ((type === 'token' || type === 'payment') && /^\d{16}$/.test(identifier)) {
      // Sadece 16 haneli kart numaraları için maskeleme
      return identifier.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1****$4');
    }
    // OrderID, PaymentID gibi diğer tüm önemli bilgiler tam gösterilsin
    return identifier;
  };

  if (!steps.length) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-xs text-neutral-400">Henüz test adımı bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div id="detailed-test-report" className="space-y-4">
      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm rounded-lg transition-colors"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              PDF oluşturuluyor...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF İndir
            </>
          )}
        </button>
      </div>

      {/* Test Steps */}
      <div className="space-y-2">
      {Object.entries(groupedSteps).map(([type, steps]) => (
        <div key={type} className="border border-neutral-700 rounded-lg overflow-hidden">
          {/* Type Header (Token Alma, Ödeme, etc.) */}
          <button
            onClick={() => toggleType(type)}
            className="w-full px-4 py-3 text-left flex items-center justify-between bg-neutral-800 hover:bg-neutral-750 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-neutral-100">
                {getTypeLabel(type)}
              </span>
              <span className="text-xs text-neutral-300 bg-neutral-700 px-2 py-1 rounded">
                {steps.length} adım
              </span>
              {/* Genel başarı/hata durumu */}
              <div className="flex gap-1">
                {steps.some(s => s.status === 'success') && (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded">Başarılı</span>
                )}
                {steps.some(s => s.status === 'error') && (
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">Hatalı</span>
                )}
              </div>
            </div>
            <span className="text-neutral-400 text-sm">
              {expandedTypes.has(type) ? '−' : '+'}
            </span>
          </button>

          {/* Type Content - Direct Steps */}
          {expandedTypes.has(type) && (
            <div className="bg-neutral-900/50">
              {steps.map((step) => {
                // Kart numarası/Payment ID'sini çıkar (gösterim için)
                let identifier = '';
                if (step.type === 'token' || step.type === 'payment') {
                  if (step.cardNumber && step.cardNumber !== 'unknown') {
                    identifier = formatIdentifier(step.type, step.cardNumber);
                  } else if (step.request?.cardNumber) {
                    identifier = formatIdentifier(step.type, step.request.cardNumber);
                  } else if (step.request?.ccno) {
                    identifier = formatIdentifier(step.type, step.request.ccno);
                  } else if (step.response?.maskedCard) {
                    identifier = step.response.maskedCard;
                  }
                } else {
                  if (step.paymentId && step.paymentId !== 'unknown') {
                    identifier = step.paymentId;
                  } else if (step.request?.paymentId) {
                    identifier = step.request.paymentId;
                  }
                }

                return (
                  <div key={step.id} className="border-t border-neutral-700">
                    {/* Step Header */}
                    <button
                      onClick={() => toggleStep(step.id)}
                      className={`w-full px-6 py-3 text-left flex items-center justify-between hover:bg-neutral-800/30 transition-colors border-l-4 ${
                        step.status === 'success' ? 'border-l-emerald-500 bg-emerald-950/10' : 
                        step.status === 'error' ? 'border-l-red-500 bg-red-950/10' : 
                        'border-l-amber-500 bg-amber-950/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${
                          step.status === 'success' ? 'bg-emerald-500' : 
                          step.status === 'error' ? 'bg-red-500' : 
                          'bg-amber-500 animate-pulse'
                        }`} />
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${
                            step.status === 'success' ? 'text-emerald-300' : 
                            step.status === 'error' ? 'text-red-300' : 'text-amber-300'
                          }`}>
                            {new Date(step.timestamp).toLocaleString('tr-TR')}
                            {identifier && (
                              <span className="ml-2 text-xs text-neutral-400">
                                ({step.type === 'token' || step.type === 'payment' ? 'Kart' : 'Payment'}: {identifier})
                              </span>
                            )}
                          </span>
                          {step.message && (
                            <span className="text-xs text-neutral-400">{step.message}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-neutral-500 text-sm">
                        {expandedSteps.has(step.id) ? '−' : '+'}
                      </span>
                    </button>

                            {/* Step Details */}
                            {expandedSteps.has(step.id) && (
                              <div className="px-6 pb-4 space-y-4 bg-neutral-950/50">
                                {/* Önemli Bilgiler Kutusu */}
                                {(() => {
                                  const importantInfo: Record<string, string> = {};
                                  
                                  // Request'ten önemli bilgileri çıkar
                                  if (step.request && typeof step.request === 'object') {
                                    const req = step.request as any;
                                    if (req.orderId) importantInfo['Order ID'] = req.orderId;
                                    if (req.orderNumber) importantInfo['Order Number'] = req.orderNumber;
                                    if (req.paymentId) importantInfo['Payment ID'] = req.paymentId;
                                    if (req.payment_id) importantInfo['Payment ID'] = req.payment_id;
                                    if (req.transactionId) importantInfo['Transaction ID'] = req.transactionId;
                                    if (req.transaction_id) importantInfo['Transaction ID'] = req.transaction_id;
                                    if (req.merchantOrderId) importantInfo['Merchant Order ID'] = req.merchantOrderId;
                                    if (req.referenceNumber) importantInfo['Reference Number'] = req.referenceNumber;
                                  }
                                  
                                  // Response'tan önemli bilgileri çıkar
                                  if (step.response && typeof step.response === 'object') {
                                    const res = step.response as any;
                                    if (res.orderId && !importantInfo['Order ID']) importantInfo['Order ID'] = res.orderId;
                                    if (res.orderNumber && !importantInfo['Order Number']) importantInfo['Order Number'] = res.orderNumber;
                                    if (res.paymentId && !importantInfo['Payment ID']) importantInfo['Payment ID'] = res.paymentId;
                                    if (res.payment_id && !importantInfo['Payment ID']) importantInfo['Payment ID'] = res.payment_id;
                                    if (res.transactionId && !importantInfo['Transaction ID']) importantInfo['Transaction ID'] = res.transactionId;
                                    if (res.transaction_id && !importantInfo['Transaction ID']) importantInfo['Transaction ID'] = res.transaction_id;
                                    if (res.merchantOrderId && !importantInfo['Merchant Order ID']) importantInfo['Merchant Order ID'] = res.merchantOrderId;
                                    if (res.referenceNumber && !importantInfo['Reference Number']) importantInfo['Reference Number'] = res.referenceNumber;
                                  }
                                  
                                  if (Object.keys(importantInfo).length > 0) {
                                    return (
                                      <div className="mb-4 p-3 bg-blue-950/30 border border-blue-700/30 rounded-lg">
                                        <div className="text-xs font-medium text-blue-300 mb-2">Önemli Bilgiler</div>
                                        <div className="grid grid-cols-1 gap-1 text-xs">
                                          {Object.entries(importantInfo).map(([key, value]) => (
                                            <div key={key} className="flex flex-wrap">
                                              <span className="text-blue-200 font-medium min-w-[100px] flex-shrink-0">{key}:</span>
                                              <span className="text-blue-100 font-mono bg-blue-900/30 px-1 rounded break-all flex-1 min-w-0">{value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                                
                                {step.request && (
                                  <div>
                                    <h5 className={`text-xs font-medium mb-2 ${
                                      step.status === 'success' ? 'text-emerald-400' : 
                                      step.status === 'error' ? 'text-red-400' : 'text-neutral-400'
                                    }`}>
                                      Request {step.status === 'success' ? '(Başarılı)' : step.status === 'error' ? '(Hatalı)' : '(Bekliyor)'}
                                    </h5>
                                    <div className={`rounded-lg border ${
                                      step.status === 'success' ? 'border-emerald-700/30 bg-emerald-950/20' : 
                                      step.status === 'error' ? 'border-red-700/30 bg-red-950/20' : 'border-neutral-700'
                                    }`}>
                                      <CodeBlock value={step.request} lang="json" />
                                    </div>
                                  </div>
                                )}
                                {step.response && (
                                  <div>
                                    <h5 className={`text-xs font-medium mb-2 ${
                                      step.status === 'success' ? 'text-emerald-400' : 
                                      step.status === 'error' ? 'text-red-400' : 'text-neutral-400'
                                    }`}>
                                      Response {step.status === 'success' ? '(Başarılı)' : step.status === 'error' ? '(Hatalı)' : '(Bekliyor)'}
                                    </h5>
                                    <div className={`rounded-lg border ${
                                      step.status === 'success' ? 'border-emerald-700/30 bg-emerald-950/20' : 
                                      step.status === 'error' ? 'border-red-700/30 bg-red-950/20' : 'border-neutral-700'
                                    }`}>
                                      <CodeBlock value={step.response} lang="json" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
