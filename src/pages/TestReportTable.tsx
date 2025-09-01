import React from 'react';

interface TestScenario {
  id: string;
  name: string;
  endpoint: string;
  status: 'success' | 'failed' | 'pending';
  duration: number;
  details: {
    token?: string;
    hash?: string;
    paymentId?: string;
    orderId?: string;
    amount?: number;
    errorCode?: string;
    errorMessage?: string;
  };
  timestamp: string;
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    statusText: string;
    headers?: Record<string, string>;
    body?: any;
  };
}

export default function TestReportTable({ scenarios }: { scenarios: TestScenario[] }) {
  const getStatusColor = (status: TestScenario['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-900/50 text-green-400';
      case 'failed':
        return 'bg-red-900/50 text-red-400';
      case 'pending':
        return 'bg-yellow-900/50 text-yellow-400';
      default:
        return 'bg-neutral-900/50 text-neutral-400';
    }
  };

  const getStatusText = (status: TestScenario['status']) => {
    switch (status) {
      case 'success':
        return 'Başarılı';
      case 'failed':
        return 'Hatalı';
      case 'pending':
        return 'Beklemede';
      default:
        return 'Bilinmeyen';
    }
  };

  const formatDetails = (scenario: TestScenario) => {
    const details = [];
    
    if (scenario.details.token) {
      details.push(`${scenario.details.token.substring(0, 20)}...`);
    }
    if (scenario.details.hash) {
      details.push(`Hash: ${scenario.details.hash}`);
    }
    if (scenario.details.paymentId) {
      details.push(`Payment ID: ${scenario.details.paymentId}`);
    }
    if (scenario.details.orderId) {
      details.push(`Order ID: ${scenario.details.orderId}`);
    }
    if (scenario.details.amount) {
      details.push(`Tutar: ${scenario.details.amount} TL`);
    }
    if (scenario.details.errorCode) {
      details.push(`Hata Kodu: ${scenario.details.errorCode}`);
    }
    if (scenario.details.errorMessage) {
      details.push(`Hata: ${scenario.details.errorMessage}`);
    }

    return details;
  };

  const generatePDF = () => {
    // PDF export functionality will be implemented here
    console.log('PDF Export functionality will be implemented');
  };

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Test Raporu</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-400">
            Oluşturulma Tarihi: {new Date().toLocaleString('tr-TR')}
          </span>
          <button
            onClick={generatePDF}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF İndir
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-700">
              <th className="text-left py-3 px-4 text-sm font-medium text-neutral-300">Senaryo</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-neutral-300">Endpoint</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-neutral-300">Durum</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-neutral-300">Süre</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-neutral-300">Önemli Bilgiler</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-neutral-300">Zaman</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((scenario) => (
              <tr key={scenario.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
                <td className="py-4 px-4">
                  <div className="font-medium text-sm">{scenario.name}</div>
                </td>
                <td className="py-4 px-4">
                  <code className="text-xs bg-neutral-800/50 px-2 py-1 rounded text-blue-300">
                    {scenario.endpoint}
                  </code>
                </td>
                <td className="py-4 px-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(scenario.status)}`}>
                    {getStatusText(scenario.status)}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <span className="text-sm text-neutral-300">
                    {scenario.duration > 0 ? `${scenario.duration}ms` : '-'}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="space-y-1">
                    {formatDetails(scenario).map((detail, index) => (
                      <div key={index} className="text-xs text-neutral-400 font-mono">
                        {detail}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className="text-sm text-neutral-400">{scenario.timestamp}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm text-neutral-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            Başarılı: {scenarios.filter(s => s.status === 'success').length}
          </span>
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400"></div>
            Hatalı: {scenarios.filter(s => s.status === 'failed').length}
          </span>
          <span className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
            Beklemede: {scenarios.filter(s => s.status === 'pending').length}
          </span>
        </div>
        <div>
          Toplam Test: {scenarios.length}
        </div>
      </div>
    </div>
  );
}

export type { TestScenario };
