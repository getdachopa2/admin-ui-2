// src/components/DetailedTestReport.tsx
import { useState } from 'react';
import CodeBlock from './CodeBlock';
import { usePDFExport } from '../hooks/usePDFExport';
import type { TestScenario } from '../pages/TestReportTable';

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
  const status = (step.status === 'success' || step.status === 'error') ? step.status : 'pending';
  
  // Step name'den tip çıkarmaya çalış
  let type: 'token' | 'payment' | 'cancel' | 'refund' = 'payment';
  const name = step.name.toLowerCase();
  if (name.includes('token') || name.includes('kart token')) {
    type = 'token';
  } else if (name.includes('cancel') || name.includes('iptal')) {
    type = 'cancel';
  } else if (name.includes('refund') || name.includes('iade')) {
    type = 'refund';
  }

  // Kart numarası ve payment ID çıkarmaya çalış
  let cardNumber = 'unknown';
  let paymentId = 'unknown';
  
  if (step.request) {
    cardNumber = step.request.cardNumber || step.request.ccno || cardNumber;
    paymentId = step.request.paymentId || step.request.payment_id || paymentId;
  }
  
  if (step.response) {
    cardNumber = step.response.cardNumber || step.response.ccno || step.response.maskedCard || cardNumber;
    paymentId = step.response.paymentId || step.response.payment_id || paymentId;
  }

  return {
    id,
    type,
    timestamp,
    status: status as 'success' | 'error' | 'pending',
    message: step.message,
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

  // Mock test scenarios data for PDF
  const mockScenarios: TestScenario[] = [
    {
      id: '1',
      name: 'Token Alma',
      endpoint: '/api/auth/token',
      status: 'success',
      duration: 245,
      details: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        hash: 'a7b9c2d4e5f6g7h8i9j0k1l2m3n4o5p6'
      },
      timestamp: '21:43:40',
      request: {
        method: 'POST',
        url: 'https://api.example.com/auth/token',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'KanalKontrolBot/1.0'
        },
        body: {
          username: 'test_user',
          password: '***',
          grant_type: 'password'
        }
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          token_type: 'bearer',
          expires_in: 3600,
          hash: 'a7b9c2d4e5f6g7h8i9j0k1l2m3n4o5p6'
        }
      }
    },
    {
      id: '2', 
      name: 'Ödeme İşlemi',
      endpoint: '/api/payment/process',
      status: 'success',
      duration: 1320,
      details: {
        paymentId: '898328785',
        orderId: '000000000000000387354296',
        amount: 10.00
      },
      timestamp: '21:43:42',
      request: {
        method: 'POST',
        url: 'https://api.example.com/payment/process',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          'X-Request-ID': 'req_387354296'
        },
        body: {
          cardNumber: '4*** **** **** 1234',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '***',
          amount: 10.00,
          currency: 'TRY',
          orderId: '000000000000000387354296'
        }
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Transaction-ID': 'txn_898328785'
        },
        body: {
          paymentId: '898328785',
          status: 'approved',
          authCode: 'A12345',
          amount: 10.00,
          currency: 'TRY',
          orderId: '000000000000000387354296',
          transactionDate: '2025-09-01T21:43:42Z'
        }
      }
    },
    {
      id: '3',
      name: 'İptal İşlemi', 
      endpoint: '/api/payment/cancel',
      status: 'success',
      duration: 890,
      details: {
        paymentId: '898328784',
        orderId: '000000000000000387354295'
      },
      timestamp: '21:43:45',
      request: {
        method: 'POST',
        url: 'https://api.example.com/payment/cancel',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          'X-Request-ID': 'req_387354295'
        },
        body: {
          paymentId: '898328784',
          orderId: '000000000000000387354295',
          reason: 'customer_request'
        }
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Transaction-ID': 'txn_898328784_cancel'
        },
        body: {
          cancelId: 'cnl_898328784',
          status: 'cancelled',
          originalPaymentId: '898328784',
          orderId: '000000000000000387354295',
          cancelDate: '2025-09-01T21:43:45Z'
        }
      }
    },
    {
      id: '4',
      name: 'Durum Sorgulama',
      endpoint: '/api/payment/status',
      status: 'failed',
      duration: 0,
      details: {
        errorCode: 'TIMEOUT',
        errorMessage: 'Connection timeout after 30 seconds'
      },
      timestamp: '21:43:48',
      request: {
        method: 'GET',
        url: 'https://api.example.com/payment/status/898328783',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          'X-Request-ID': 'req_387354294'
        }
      },
      response: {
        status: 408,
        statusText: 'Request Timeout',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          error: 'TIMEOUT',
          message: 'Connection timeout after 30 seconds',
          timestamp: '2025-09-01T21:43:48Z'
        }
      }
    },
    {
      id: '5',
      name: 'İade İşlemi',
      endpoint: '/api/payment/refund', 
      status: 'pending',
      duration: 0,
      details: {
        paymentId: '898328783',
        orderId: '000000000000000387354294',
        amount: 10.00
      },
      timestamp: '21:43:50',
      request: {
        method: 'POST',
        url: 'https://api.example.com/payment/refund',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          'X-Request-ID': 'req_387354294'
        },
        body: {
          paymentId: '898328783',
          orderId: '000000000000000387354294',
          amount: 10.00,
          reason: 'customer_request'
        }
      },
      response: {
        status: 202,
        statusText: 'Accepted',
        headers: {
          'Content-Type': 'application/json',
          'X-Transaction-ID': 'txn_898328783_refund'
        },
        body: {
          refundId: 'ref_898328783',
          status: 'pending',
          originalPaymentId: '898328783',
          orderId: '000000000000000387354294',
          amount: 10.00,
          estimatedProcessingTime: '1-3 business days',
          refundDate: '2025-09-01T21:43:50Z'
        }
      }
    }
  ];

  const handleExportPDF = async () => {
    try {
      console.log('PDF export başlatılıyor...');
      console.log('Test summary:', testSummary);
      console.log('Normalized steps:', normalizedSteps.length, 'adet');
      
      // Eğer test adımları varsa, sadece bunları kullan
      if (normalizedSteps && normalizedSteps.length > 0) {
        console.log('Gerçek test adımları kullanılıyor:', normalizedSteps);
        await exportToPDF('detailed-test-report', {
          title: 'Kanal Kontrol Bot - Test Raporu',
          filename: 'kanal-kontrol-test-raporu',
          includeTimestamp: true,
          testSummary,
          testSteps: normalizedSteps,
          // scenarios: [] // Mock senaryoları kullanma
        });
      } else {
        // Eğer gerçek test adımları yoksa, mock senaryoları kullan
        console.log('Mock test senaryoları kullanılıyor:', mockScenarios);
        await exportToPDF('detailed-test-report', {
          title: 'Kanal Kontrol Bot - Test Raporu',
          filename: 'kanal-kontrol-test-raporu',
          includeTimestamp: true,
          testSummary,
          scenarios: mockScenarios
        });
      }
      
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
    
    // SADECE 16 haneli kart numaraları için maskeleme yap
    // Diğer tüm bilgiler (orderID, paymentID, transactionID vb.) tam gösterilsin
    if (/^\d{16}$/.test(identifier)) {
      // 16 haneli sayısal değer ise kart numarası kabul et ve maskele
      return identifier.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1****$4');
    }
    
    // Diğer tüm önemli bilgileri (orderID, paymentID, transactionID vb.) olduğu gibi göster
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
                    // Önce message içinden maskelenmiş kart numarasını kontrol et
                    if (step.message) {
                      const cardMatch = step.message.match(/Kart:\s*(\d{6}\*{4}\d{4})/);
                      if (cardMatch) {
                        identifier = cardMatch[1]; // Zaten maskelenmiş halde
                      }
                    }
                    
                    // Eğer message'dan bulamadıysak diğer yerlere bak
                    if (!identifier) {
                      if (step.cardNumber && step.cardNumber !== 'unknown') {
                        identifier = formatIdentifier(step.type, step.cardNumber);
                      } else if (step.request?.cardNumber) {
                        identifier = formatIdentifier(step.type, step.request.cardNumber);
                      } else if (step.request?.ccno) {
                        identifier = formatIdentifier(step.type, step.request.ccno);
                      } else if (step.response?.maskedCard) {
                        identifier = step.response.maskedCard;
                      }
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
                          step.status === 'success' ? 'border-l-emerald-500' : 
                          step.status === 'error' ? 'border-l-red-500' : 
                          'border-l-amber-500'
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
                                <span className="ml-2 text-xs text-neutral-300 font-mono break-all">
                                  ({step.type === 'token' || step.type === 'payment' ? 'Kart' : 'Payment'}: <span className="bg-neutral-800 px-1 rounded">{identifier}</span>)
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
                          {/* Önemli Bilgiler - Çerçevesiz */}
                          {(() => {
                            const importantInfo: Record<string, string> = {};
                            
                            console.log('Step type:', step.type, 'Step:', step);
                            
                            // Token işlemleri için özel bilgiler
                            if (step.type === 'token') {
                              console.log('Token işlemi algılandı');
                              // Request'ten token bilgisi
                              if (step.request && typeof step.request === 'object') {
                                const req = step.request as any;
                                if (req.orderId) importantInfo['Order ID'] = req.orderId;
                                if (req.orderNumber) importantInfo['Order Number'] = req.orderNumber;
                              }
                              
                              // Response'tan token değeri ve description
                              if (step.response && typeof step.response === 'object') {
                                const res = step.response as any;
                                if (res.token) importantInfo['Token'] = res.token;
                                if (res.responseDescription) importantInfo['Response Description'] = res.responseDescription;
                                if (res.orderId && !importantInfo['Order ID']) importantInfo['Order ID'] = res.orderId;
                                if (res.orderNumber && !importantInfo['Order Number']) importantInfo['Order Number'] = res.orderNumber;
                              }
                            }
                            // Cancel/Refund işlemleri için özel bilgiler
                            else if (step.type === 'cancel' || step.type === 'refund') {
                              console.log('Cancel/Refund işlemi algılandı');
                              // Request'ten payment ID
                              if (step.request && typeof step.request === 'object') {
                                const req = step.request as any;
                                if (req.paymentId) importantInfo['Payment ID'] = req.paymentId;
                                if (req.payment_id) importantInfo['Payment ID'] = req.payment_id;
                                if (req.orderId) importantInfo['Order ID'] = req.orderId;
                                if (req.orderNumber) importantInfo['Order Number'] = req.orderNumber;
                              }
                              
                              // Response'tan result code ve description
                              if (step.response && typeof step.response === 'object') {
                                const res = step.response as any;
                                if (res.paymentId && !importantInfo['Payment ID']) importantInfo['Payment ID'] = res.paymentId;
                                if (res.payment_id && !importantInfo['Payment ID']) importantInfo['Payment ID'] = res.payment_id;
                                if (res.resultCode) importantInfo['Result Code'] = res.resultCode;
                                if (res.resultDescription) importantInfo['Result Description'] = res.resultDescription;
                                if (res.description) importantInfo['Description'] = res.description;
                                
                                // Operation result içindeki bilgileri çıkar
                                if (res.operationResult && typeof res.operationResult === 'object') {
                                  const opResult = res.operationResult;
                                  if (opResult.resultCode && !importantInfo['Result Code']) importantInfo['Result Code'] = opResult.resultCode;
                                  if (opResult.resultDescription && !importantInfo['Result Description']) importantInfo['Result Description'] = opResult.resultDescription;
                                }
                              }
                            }
                            // Payment işlemleri için genel bilgiler
                            else {
                              console.log('Payment işlemi algılandı');
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
                                if (res.resultCode) importantInfo['Result Code'] = res.resultCode;
                                if (res.description) importantInfo['Description'] = res.description;
                                
                                // Operation result içindeki bilgileri çıkar
                                if (res.operationResult && typeof res.operationResult === 'object') {
                                  const opResult = res.operationResult;
                                  if (opResult.resultCode) importantInfo['ResultCode'] = opResult.resultCode;
                                  if (opResult.resultDescription) importantInfo['ResultDescription'] = opResult.resultDescription;
                                }
                              }
                            }
                            
                            console.log('Important info:', importantInfo);
                            
                            if (Object.keys(importantInfo).length > 0) {
                              return (
                                <div className="mb-4 space-y-1 text-xs">
                                  {Object.entries(importantInfo).map(([key, value]) => (
                                    <div key={key} className="flex flex-col sm:flex-row sm:flex-wrap gap-1">
                                      <span className="text-white font-medium min-w-[120px] flex-shrink-0">{key}:</span>
                                      <span className={`font-mono px-1 rounded word-break-all flex-1 min-w-0 whitespace-pre-wrap ${
                                        step.status === 'success' ? 'text-emerald-400' : 
                                        step.status === 'error' ? 'text-red-400' : 'text-neutral-300'
                                      }`}>{value}</span>
                                    </div>
                                  ))}
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
                              <div className="rounded-lg border border-neutral-700 bg-neutral-900">
                                <CodeBlock value={step.request} lang="json" status={step.status === 'pending' ? 'neutral' : step.status} />
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
                              <div className="rounded-lg border border-neutral-700 bg-neutral-900">
                                <CodeBlock value={step.response} lang="json" status={step.status === 'pending' ? 'neutral' : step.status} />
                              </div>
                            </div>
                          )}
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
