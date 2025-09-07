import React, { useState } from 'react';

interface BankRegressionReportProps {
  steps: any[];
  isCompleted: boolean;
}

interface BankGroup {
  bankName: string;
  operations: {
    tokenAlma: any[];
    odeme: any[];
    iptal: any[];
    iade: any[];
  };
  metrics: {
    tokenAlma: { success: number; total: number; rate: number };
    odeme: { success: number; total: number; rate: number };
    iptal: { success: number; total: number; rate: number };
    iade: { success: number; total: number; rate: number };
    overall: { success: number; total: number; rate: number };
  };
}

export default function BankRegressionReport({ steps, isCompleted }: BankRegressionReportProps) {
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(new Set());

  // Banka adlarını tespit et
  const getBankFromStep = (step: any): string | null => {
    const text = `${step.name || ''} ${step.message || ''}`.toLowerCase();
    
    const bankPatterns: { [key: string]: string[] } = {
      'AKBANK': ['akbank', 'akbnk'],
      'DENİZBANK': ['denizbank', 'deniz'],
      'GARANTİ': ['garanti', 'grnt'],
      'VAKIFBANK': ['vakifbank', 'vakıf', 'vkf'],
      'KUVEYT': ['kuveyt', 'kvt'],
      'HALKBANK': ['halkbank', 'hlk'],
      'İŞBANK': ['işbank', 'isbank', 'işbnk'],
      'ZIRAAT': ['ziraat', 'zrt'],
      'QNB FİNANS': ['qnb', 'finans'],
      'YAPIKRED': ['yapıkredi', 'ykb']
    };

    for (const [bankName, patterns] of Object.entries(bankPatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        return bankName;
      }
    }

    return null;
  };

  // Operasyon tipini tespit et
  const getOperationType = (step: any): string => {
    const text = `${step.name || ''} ${step.message || ''}`.toLowerCase();
    
    if (text.includes('token')) return 'tokenAlma';
    if (text.includes('iptal') || text.includes('cancel')) return 'iptal';
    if (text.includes('iade') || text.includes('refund')) return 'iade';
    if (text.includes('ödeme') || text.includes('payment')) return 'odeme';
    
    return 'odeme'; // default
  };

  // Metrics hesaplama fonksiyonu
  const calculateMetrics = (operations: any[]) => {
    const total = operations.length;
    const success = operations.filter(op => op.status === 'success').length;
    const rate = total > 0 ? Math.round((success / total) * 100) : 0;
    return { success, total, rate };
  };

  // Adımları bankalara göre grupla
  const bankGroups: { [key: string]: BankGroup } = {};
  
  steps.forEach(step => {
    const bankName = getBankFromStep(step);
    if (!bankName) return;

    if (!bankGroups[bankName]) {
      bankGroups[bankName] = {
        bankName,
        operations: {
          tokenAlma: [],
          odeme: [],
          iptal: [],
          iade: []
        },
        metrics: {
          tokenAlma: { success: 0, total: 0, rate: 0 },
          odeme: { success: 0, total: 0, rate: 0 },
          iptal: { success: 0, total: 0, rate: 0 },
          iade: { success: 0, total: 0, rate: 0 },
          overall: { success: 0, total: 0, rate: 0 }
        }
      };
    }

    const operationType = getOperationType(step);
    bankGroups[bankName].operations[operationType].push(step);
  });

  // Metrics'leri hesapla
  Object.values(bankGroups).forEach(bankGroup => {
    bankGroup.metrics.tokenAlma = calculateMetrics(bankGroup.operations.tokenAlma);
    bankGroup.metrics.odeme = calculateMetrics(bankGroup.operations.odeme);
    bankGroup.metrics.iptal = calculateMetrics(bankGroup.operations.iptal);
    bankGroup.metrics.iade = calculateMetrics(bankGroup.operations.iade);
    
    // Overall metrics
    const allOperations = [
      ...bankGroup.operations.tokenAlma,
      ...bankGroup.operations.odeme,
      ...bankGroup.operations.iptal,
      ...bankGroup.operations.iade
    ];
    bankGroup.metrics.overall = calculateMetrics(allOperations);
  });

  const toggleBankExpansion = (bankName: string) => {
    const newExpanded = new Set(expandedBanks);
    if (newExpanded.has(bankName)) {
      newExpanded.delete(bankName);
    } else {
      newExpanded.add(bankName);
    }
    setExpandedBanks(newExpanded);
  };

  const toggleOperationExpansion = (operationKey: string) => {
    const newExpanded = new Set(expandedOperations);
    if (newExpanded.has(operationKey)) {
      newExpanded.delete(operationKey);
    } else {
      newExpanded.add(operationKey);
    }
    setExpandedOperations(newExpanded);
  };

  const getOperationTitle = (type: string): string => {
    switch (type) {
      case 'tokenAlma': return 'Token Alma';
      case 'odeme': return 'Ödeme';
      case 'iptal': return 'İptal';
      case 'iade': return 'İade';
      default: return type;
    }
  };

  const getOperationIcon = (type: string): string => {
    switch (type) {
      case 'tokenAlma': return 'fas fa-key';
      case 'odeme': return 'fas fa-credit-card';
      case 'iptal': return 'fas fa-times-circle';
      case 'iade': return 'fas fa-undo';
      default: return 'fas fa-cog';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'running': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'success': return 'fas fa-check-circle';
      case 'error': return 'fas fa-times-circle';
      case 'running': return 'fas fa-spinner fa-spin';
      default: return 'fas fa-clock';
    }
  };

  const getMetricColor = (rate: number): string => {
    if (rate >= 95) return 'text-green-400';
    if (rate >= 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Genel özet metrics
  const overallMetrics = {
    totalBanks: Object.keys(bankGroups).length,
    activeBanks: Object.values(bankGroups).filter(bank => bank.metrics.overall.total > 0).length,
    successfulBanks: Object.values(bankGroups).filter(bank => bank.metrics.overall.rate === 100).length,
    averageSuccessRate: Object.values(bankGroups).length > 0 
      ? Math.round(Object.values(bankGroups).reduce((acc, bank) => acc + bank.metrics.overall.rate, 0) / Object.values(bankGroups).length)
      : 0
  };

  if (Object.keys(bankGroups).length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">
          <i className="fas fa-university mr-2"></i>
          Banka Regresyon Raporu
        </h3>
        <p className="text-gray-400">Henüz banka test sonuçları bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Genel Özet Bölümü */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">
          <i className="fas fa-chart-bar mr-2"></i>
          Regresyon Testi Özeti
        </h3>
        
        {/* Özet Metrikler */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {overallMetrics.activeBanks}/{overallMetrics.totalBanks}
            </div>
            <div className="text-sm text-gray-300">Test Edilen Bankalar</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">
              {overallMetrics.successfulBanks}
            </div>
            <div className="text-sm text-gray-300">%100 Başarılı</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className={`text-2xl font-bold ${getMetricColor(overallMetrics.averageSuccessRate)}`}>
              %{overallMetrics.averageSuccessRate}
            </div>
            <div className="text-sm text-gray-300">Ortalama Başarı</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {Object.values(bankGroups).reduce((acc, bank) => acc + bank.metrics.overall.total, 0)}
            </div>
            <div className="text-sm text-gray-300">Toplam İşlem</div>
          </div>
        </div>

        {/* Banka Bazlı Hızlı Özet */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-300 mb-3">Banka Durumları:</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Object.values(bankGroups).map((bank) => (
              <div key={bank.bankName} className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{bank.bankName}</span>
                  <span className={`text-sm font-bold ${getMetricColor(bank.metrics.overall.rate)}`}>
                    %{bank.metrics.overall.rate}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center">
                    <div className={`font-medium ${getMetricColor(bank.metrics.tokenAlma.rate)}`}>
                      {bank.metrics.tokenAlma.success}/{bank.metrics.tokenAlma.total}
                    </div>
                    <div className="text-gray-400">Token</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-medium ${getMetricColor(bank.metrics.odeme.rate)}`}>
                      {bank.metrics.odeme.success}/{bank.metrics.odeme.total}
                    </div>
                    <div className="text-gray-400">Ödeme</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-medium ${getMetricColor(bank.metrics.iptal.rate)}`}>
                      {bank.metrics.iptal.success}/{bank.metrics.iptal.total}
                    </div>
                    <div className="text-gray-400">İptal</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-medium ${getMetricColor(bank.metrics.iade.rate)}`}>
                      {bank.metrics.iade.success}/{bank.metrics.iade.total}
                    </div>
                    <div className="text-gray-400">İade</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detaylı Banka Raporları */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">
          <i className="fas fa-university mr-2"></i>
          Detaylı Banka Raporları
        </h3>

        <div className="space-y-4">
          {Object.values(bankGroups).map((bankGroup) => (
            <div key={bankGroup.bankName} className="border border-gray-700 rounded-lg">
              {/* Banka Header */}
              <button
                onClick={() => toggleBankExpansion(bankGroup.bankName)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-t-lg transition-colors"
              >
                <div className="flex items-center">
                  <i className="fas fa-university mr-3 text-blue-400"></i>
                  <span className="font-medium">{bankGroup.bankName}</span>
                  <div className="ml-4 flex items-center space-x-4 text-sm">
                    <span className={`font-medium ${getMetricColor(bankGroup.metrics.overall.rate)}`}>
                      Genel: %{bankGroup.metrics.overall.rate} ({bankGroup.metrics.overall.success}/{bankGroup.metrics.overall.total})
                    </span>
                  </div>
                </div>
                <i className={`fas fa-chevron-${expandedBanks.has(bankGroup.bankName) ? 'up' : 'down'} text-gray-400`}></i>
              </button>

            {/* Banka Content */}
            {expandedBanks.has(bankGroup.bankName) && (
              <div className="p-4 bg-gray-900 rounded-b-lg">
                <div className="space-y-3">
                  {Object.entries(bankGroup.operations).map(([operationType, operations]) => {
                    if (operations.length === 0) return null;
                    
                    const operationKey = `${bankGroup.bankName}-${operationType}`;
                    
                    return (
                      <div key={operationType} className="border border-gray-600 rounded">
                        {/* Operasyon Header */}
                        <button
                          onClick={() => toggleOperationExpansion(operationKey)}
                          className="w-full px-3 py-2 flex items-center justify-between bg-gray-800 hover:bg-gray-750 rounded-t transition-colors"
                        >
                          <div className="flex items-center">
                            <i className={`${getOperationIcon(operationType)} mr-2 text-sm`}></i>
                            <span className="text-sm font-medium">{getOperationTitle(operationType)}</span>
                            <span className="ml-2 px-2 py-1 bg-gray-700 rounded text-xs">
                              {operations.length} işlem
                            </span>
                          </div>
                          <i className={`fas fa-chevron-${expandedOperations.has(operationKey) ? 'up' : 'down'} text-gray-400 text-sm`}></i>
                        </button>

                        {/* Operasyon Content */}
                        {expandedOperations.has(operationKey) && (
                          <div className="p-3 bg-gray-850 rounded-b">
                            <div className="space-y-2">
                              {operations.map((step, index) => (
                                <div key={index} className="bg-gray-800 rounded p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center">
                                      <i className={`${getStatusIcon(step.status)} ${getStatusColor(step.status)} mr-2 text-sm`}></i>
                                      <span className="text-sm font-medium">{step.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                      {new Date(step.time).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  
                                  {step.message && (
                                    <p className="text-sm text-gray-300 mb-2">{step.message}</p>
                                  )}

                                  {/* Request/Response */}
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    {step.request && (
                                      <div>
                                        <h5 className="text-xs font-medium text-gray-400 mb-1">Request:</h5>
                                        <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
                                          {JSON.stringify(step.request, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                    
                                    {step.response && (
                                      <div>
                                        <h5 className="text-xs font-medium text-gray-400 mb-1">Response:</h5>
                                        <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
                                          {JSON.stringify(step.response, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
