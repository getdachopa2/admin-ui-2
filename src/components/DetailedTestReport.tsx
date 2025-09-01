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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
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

  // Group steps first by type, then by card/payment identifier
  const groupedSteps = mergedSteps.reduce((acc, step) => {
    const typeKey = step.type;
    
    if (!acc[typeKey]) {
      acc[typeKey] = {};
    }
    
    let identifier: string;
    if (step.type === 'token' || step.type === 'payment') {
      // Kart numarası varsa onu kullan, yoksa request/response'dan çıkarmaya çalış
      if (step.cardNumber && step.cardNumber !== 'unknown') {
        identifier = step.cardNumber;
      } else if (step.request?.cardNumber) {
        identifier = step.request.cardNumber;
      } else if (step.response?.maskedCard) {
        identifier = step.response.maskedCard;
      } else {
        identifier = `Card-${step.id}`;
      }
    } else {
      // Cancel/refund için payment ID kullan
      if (step.paymentId && step.paymentId !== 'unknown') {
        identifier = step.paymentId;
      } else if (step.request?.paymentId) {
        identifier = step.request.paymentId;
      } else {
        identifier = `Payment-${step.id}`;
      }
    }
    
    if (!acc[typeKey][identifier]) {
      acc[typeKey][identifier] = [];
    }
    
    acc[typeKey][identifier].push(step);
    return acc;
  }, {} as Record<string, Record<string, TestStep[]>>);

  const toggleType = (type: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  const toggleCard = (cardKey: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(cardKey)) {
      newExpanded.delete(cardKey);
    } else {
      newExpanded.add(cardKey);
    }
    setExpandedCards(newExpanded);
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
    if (type === 'token' || type === 'payment') {
      return identifier.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1****$4');
    }
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
      {Object.entries(groupedSteps).map(([type, identifierGroups]) => (
        <div key={type} className="border border-neutral-700 rounded-lg overflow-hidden">
          {/* Type Header (Token Alma, Ödeme, etc.) */}
          <button
            onClick={() => toggleType(type)}
            className="w-full px-4 py-3 text-left flex items-center justify-between bg-neutral-800 hover:bg-neutral-750 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-neutral-200">{getTypeLabel(type)}</span>
              <span className="text-xs text-neutral-400 bg-neutral-700 px-2 py-1 rounded">
                {Object.values(identifierGroups).reduce((sum, steps) => sum + steps.length, 0)} adım
              </span>
            </div>
            <span className="text-neutral-400 text-sm">
              {expandedTypes.has(type) ? '−' : '+'}
            </span>
          </button>

          {/* Type Content - Card/Payment Groups */}
          {expandedTypes.has(type) && (
            <div className="bg-neutral-900/50">
              {Object.entries(identifierGroups).map(([identifier, steps]) => {
                const cardKey = `${type}-${identifier}`;
                return (
                  <div key={cardKey} className="border-t border-neutral-700">
                    {/* Card/Payment Header */}
                    <button
                      onClick={() => toggleCard(cardKey)}
                      className="w-full px-5 py-3 text-left flex items-center justify-between hover:bg-neutral-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-neutral-300 font-mono">
                          {type === 'token' || type === 'payment' ? 'Kart' : 'Payment ID'}: {formatIdentifier(type, identifier)}
                        </span>
                        <span className="text-xs text-neutral-500 bg-neutral-700 px-2 py-1 rounded">{steps.length} işlem</span>
                      </div>
                      <span className="text-neutral-500 text-sm">
                        {expandedCards.has(cardKey) ? '−' : '+'}
                      </span>
                    </button>

                    {/* Card/Payment Steps */}
                    {expandedCards.has(cardKey) && (
                      <div className="bg-neutral-900/70">
                        {steps.map((step) => (
                          <div key={step.id} className="border-t border-neutral-700">
                            {/* Step Header */}
                            <button
                              onClick={() => toggleStep(step.id)}
                              className="w-full px-6 py-3 text-left flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${getStatusColor(step.status).split(' ')[1]}`} />
                                <div className="flex flex-col">
                                  <span className="text-xs text-neutral-300">
                                    {new Date(step.timestamp).toLocaleString('tr-TR')}
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
                                {step.request && (
                                  <div>
                                    <h5 className="text-xs font-medium text-neutral-400 mb-2">Request:</h5>
                                    <CodeBlock value={step.request} lang="json" />
                                  </div>
                                )}
                                {step.response && (
                                  <div>
                                    <h5 className="text-xs font-medium text-neutral-400 mb-2">Response:</h5>
                                    <CodeBlock value={step.response} lang="json" />
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
