// src/components/TestSummaryReport.tsx
import React, { useState } from 'react';
import { maskPan } from '@/utils/card';

interface TestStep {
  time: string;
  name: string;
  status: string;
  message?: string;
  seq?: number;
  request?: any;
  response?: any;
}

interface TestSummary {
  scenario?: string;
  environment?: string;
  channel?: string;
  application?: string;
  cards?: any[];
  cancelRefund?: any[];
}

interface TestSummaryReportProps {
  steps: TestStep[];
  testSummary?: TestSummary;
  currentFlow: 'payment' | 'cancelRefund';
  isCompleted: boolean;
}

const TestSummaryReport: React.FC<TestSummaryReportProps> = ({ 
  steps, 
  testSummary, 
  currentFlow,
  isCompleted 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'details'>('overview');
  const [copiedCode, setCopiedCode] = useState<string>('');
  
  // Copy to clipboard function
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  // Format JSON function
  const formatJson = (data: any): string => {
    return JSON.stringify(data, null, 2);
  };

  // Extract SOAP Body and format XML
  const formatXmlOrJson = (data: any): { content: string; type: string } => {
    if (typeof data === 'string' && data.includes('<soapenv:')) {
      try {
        // Extract SOAP Body content
        const bodyMatch = data.match(/<soapenv:Body>(.*?)<\/soapenv:Body>/s);
        if (bodyMatch) {
          let bodyContent = bodyMatch[1].trim();
          
          // Simple but effective XML formatting
          const formatXml = (xml: string): string => {
            // Remove all extra whitespace first
            xml = xml.replace(/>\s+</g, '><').trim();
            
            // Add line breaks between tags
            xml = xml.replace(/></g, '>\n<');
            
            // Split into lines and add proper indentation
            const lines = xml.split('\n');
            let indentLevel = 0;
            const indentSize = 2;
            
            return lines.map(line => {
              line = line.trim();
              
              // Decrease indent for closing tags
              if (line.startsWith('</')) {
                indentLevel = Math.max(0, indentLevel - indentSize);
              }
              
              const indentedLine = ' '.repeat(indentLevel) + line;
              
              // Increase indent for opening tags (but not self-closing)
              if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) {
                indentLevel += indentSize;
              }
              
              return indentedLine;
            }).join('\n');
          };
          
          const formatted = formatXml(bodyContent);
          console.log('Formatted XML:', formatted); // Debug
          return { content: formatted, type: 'XML' };
        }
      } catch (e) {
        console.error('XML parsing error:', e);
      }
    }
    
    // Handle string XML (not SOAP)
    if (typeof data === 'string' && (data.trim().startsWith('<') || data.includes('<?xml'))) {
      try {
        const formatSimpleXml = (xml: string): string => {
          xml = xml.replace(/>\s+</g, '><').trim();
          xml = xml.replace(/></g, '>\n<');
          
          const lines = xml.split('\n');
          let indentLevel = 0;
          
          return lines.map(line => {
            line = line.trim();
            if (line.startsWith('</')) indentLevel = Math.max(0, indentLevel - 2);
            const indentedLine = ' '.repeat(indentLevel) + line;
            if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) indentLevel += 2;
            return indentedLine;
          }).join('\n');
        };
        
        return { content: formatSimpleXml(data), type: 'XML' };
      } catch (e) {
        console.error('Simple XML parsing error:', e);
      }
    }
    
    // Default to JSON formatting
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return { content: JSON.stringify(parsed, null, 2), type: 'JSON' };
      } catch {
        return { content: data, type: 'TEXT' };
      }
    }
    
    return { content: JSON.stringify(data, null, 2), type: 'JSON' };
  };
  
  if (!isCompleted || steps.length === 0) {
    return null;
  }

  const successSteps = steps.filter(s => s.status === 'success').length;
  const errorSteps = steps.filter(s => s.status === 'error').length;
  const totalDuration = steps.length > 0 ? 
    Math.round((new Date(steps[steps.length - 1].time).getTime() - new Date(steps[0].time).getTime()) / 1000) : 0;

  // Adımları işlem tipine göre grupla
  const groupStepsByType = (steps: TestStep[]) => {
    const groups: { [key: string]: TestStep[] } = {};
    
    steps.forEach(step => {
      const name = step.name.toLowerCase();
      let groupKey = 'Diğer İşlemler';
      
      // Skip preparation/ready steps - bunları gösterme
      if (name.includes('hazır') || name.includes('ready') || name.includes('prepared') || 
          name.includes('soap hazır') || name.includes('preparing') || name.includes('setup')) {
        return; // Bu adımı atla
      }
      
      if (name.includes('token') || name.includes('secure') || name.includes('getcardtoken')) {
        groupKey = 'Token Alma';
      } else if (name.includes('payment') || name.includes('odeme') || name.includes('pay') || 
                 name.includes('ödeme') || name.includes('pos') || name.includes('charge') ||
                 name.includes('transaction') || name.includes('işlem')) {
        groupKey = 'Ödeme İşlemleri';
      } else if (name.includes('cancel') || name.includes('iptal') || name.includes('void')) {
        groupKey = 'İptal İşlemleri';
      } else if (name.includes('refund') || name.includes('iade') || name.includes('return')) {
        groupKey = 'İade İşlemleri';
      } else if (name.includes('verify') || name.includes('dogrula') || name.includes('check')) {
        groupKey = 'Doğrulama';
      } else if (name.includes('otp') || name.includes('sms')) {
        groupKey = 'OTP İşlemleri';
      } else if (name.includes('query') || name.includes('sonuc') || name.includes('result') || name.includes('status')) {
        groupKey = 'Sorgu İşlemleri';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(step);
    });
    
    return groups;
  };

  const groupedSteps = groupStepsByType(steps);

  const extractCardNumber = (step: TestStep): string | null => {
    try {
      const stepStr = JSON.stringify(step);
      const cardMatch = stepStr.match(/"(?:cardNo|creditCardNo|pan)"\s*:\s*"([^"]+)"/i) ||
                       stepStr.match(/"([45]\d{15})"/);
      return cardMatch ? cardMatch[1] : null;
    } catch {
      return null;
    }
  };

  const extractPaymentId = (step: TestStep): string | null => {
    try {
      const stepStr = JSON.stringify(step);
      const paymentMatch = stepStr.match(/"(?:paymentId|transactionId|orderId)"\s*:\s*"?([^",]+)"?/i);
      return paymentMatch ? paymentMatch[1] : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Özet Bilgiler - Üstte */}
      <div className="rounded-lg border border-neutral-700 bg-gradient-to-br from-neutral-900/80 to-neutral-800/50 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-neutral-200 flex items-center gap-2">
            Test Raporu
            <span className={`text-xs px-2 py-1 rounded ${
              currentFlow === 'payment' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {currentFlow === 'payment' ? 'Payment' : 'Cancel/Refund'}
            </span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <div className={`h-2 w-2 rounded-full ${errorSteps > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
            {errorSteps > 0 ? 'Hatalar Var' : 'Başarılı'}
          </div>
        </div>
        
        {/* Test Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-neutral-800/50 rounded p-3 text-center">
            <div className="text-lg font-bold text-green-400">{successSteps}</div>
            <div className="text-xs text-neutral-400">Başarılı</div>
          </div>
          <div className="bg-neutral-800/50 rounded p-3 text-center">
            <div className="text-lg font-bold text-red-400">{errorSteps}</div>
            <div className="text-xs text-neutral-400">Hata</div>
          </div>
          <div className="bg-neutral-800/50 rounded p-3 text-center">
            <div className="text-lg font-bold text-neutral-200">{steps.length}</div>
            <div className="text-xs text-neutral-400">Toplam Adım</div>
          </div>
          <div className="bg-neutral-800/50 rounded p-3 text-center">
            <div className="text-lg font-bold text-blue-400">{totalDuration}s</div>
            <div className="text-xs text-neutral-400">Süre</div>
          </div>
        </div>

        {/* Test Configuration */}
        {testSummary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {testSummary.scenario && (
              <div className="flex justify-between p-2 rounded bg-neutral-800/30">
                <span className="text-neutral-400">Senaryo:</span>
                <span className="text-neutral-200">{testSummary.scenario}</span>
              </div>
            )}
            {testSummary.environment && (
              <div className="flex justify-between p-2 rounded bg-neutral-800/30">
                <span className="text-neutral-400">Ortam:</span>
                <span className="text-neutral-200">{testSummary.environment}</span>
              </div>
            )}
            {testSummary.channel && (
              <div className="flex justify-between p-2 rounded bg-neutral-800/30">
                <span className="text-neutral-400">Kanal:</span>
                <span className="text-neutral-200">{testSummary.channel}</span>
              </div>
            )}
            {testSummary.application && (
              <div className="flex justify-between p-2 rounded bg-neutral-800/30">
                <span className="text-neutral-400">Uygulama:</span>
                <span className="text-neutral-200">{testSummary.application}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expandable Kategoriler */}
      <div className="grid grid-cols-1 gap-4">
        {['Token Alma', 'Ödeme İşlemleri', 'İptal İşlemleri', 'İade İşlemleri'].map((category) => {
          const categorySteps = groupedSteps[category] || [];
          const categoryRequests = categorySteps.filter(step => step.request || step.response);
          
          return (
            <details key={category} className="group rounded-lg border border-neutral-700 bg-gradient-to-br from-neutral-900/80 to-neutral-800/50 backdrop-blur-sm">
              <summary className="cursor-pointer p-4 hover:bg-neutral-800/50 transition-colors rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-neutral-200">{category}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">{categoryRequests.length} istek</span>
                  </div>
                </div>
              </summary>
              
              <div className="px-4 pb-4 space-y-3 overflow-y-auto" style={{ maxHeight: '80vh' }}>
                {categoryRequests.length > 0 ? (
                  categoryRequests.map((step, index) => (
                    <div key={index} className="rounded border border-neutral-700/50 bg-neutral-800/30">
                      <div className="p-3 border-b border-neutral-700/50">
                        <div className="flex items-center gap-2 text-sm">
                          <div className={`h-2 w-2 rounded-full ${
                            step.status === 'success' ? 'bg-green-500' : 
                            step.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                          }`}></div>
                          <span className="text-neutral-200 flex-1">{step.name}</span>
                        </div>
                      </div>
                      
                      {(step.request || step.response) && (
                        <div className="p-3 space-y-3">
                          {step.request && (
                            <div className="rounded-lg border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-600/10">
                              {(() => {
                                const formatted = formatXmlOrJson(step.request);
                                return (
                                  <>
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-blue-500/20 bg-blue-500/10">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-blue-400"></div>
                                        <span className="text-blue-300 text-xs font-medium">Request</span>
                                        <div className="text-xs text-blue-400/70">{formatted.type}</div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => copyToClipboard(formatted.content, `req-${index}`)}
                                          className="p-1 hover:bg-blue-500/20 rounded transition-colors text-xs px-2"
                                          title="Copy"
                                        >
                                          {copiedCode === `req-${index}` ? 'Copied' : 'Copy'}
                                        </button>
                                        <button
                                          onClick={() => {
                                            copyToClipboard(formatted.content, `req-fmt-${index}`);
                                          }}
                                          className="p-1 hover:bg-blue-500/20 rounded transition-colors text-xs px-2"
                                          title="Format & Copy"
                                        >
                                          Format
                                        </button>
                                      </div>
                                    </div>
                                    <pre className="text-neutral-300 bg-neutral-900/50 p-3 text-xs overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                                      {formatted.content}
                                    </pre>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                          
                          {step.response && (
                            <div className="rounded-lg border border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-600/10">
                              {(() => {
                                const formatted = formatXmlOrJson(step.response);
                                return (
                                  <>
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-green-500/20 bg-green-500/10">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-400"></div>
                                        <span className="text-green-300 text-xs font-medium">Response</span>
                                        <div className="text-xs text-green-400/70">{formatted.type}</div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => copyToClipboard(formatted.content, `res-${index}`)}
                                          className="p-1 hover:bg-green-500/20 rounded transition-colors text-xs px-2"
                                          title="Copy"
                                        >
                                          {copiedCode === `res-${index}` ? 'Copied' : 'Copy'}
                                        </button>
                                        <button
                                          onClick={() => {
                                            copyToClipboard(formatted.content, `res-fmt-${index}`);
                                          }}
                                          className="p-1 hover:bg-green-500/20 rounded transition-colors text-xs px-2"
                                          title="Format & Copy"
                                        >
                                          Format
                                        </button>
                                      </div>
                                    </div>
                                    <pre className="text-neutral-300 bg-neutral-900/50 p-3 text-xs overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap">
                                      {formatted.content}
                                    </pre>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-neutral-400 text-sm">
                    Bu kategoride henüz işlem yok
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
};

export default TestSummaryReport;
