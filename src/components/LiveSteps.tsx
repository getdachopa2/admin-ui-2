// src/components/LiveSteps.tsx
import React, { useEffect, useRef, useState } from 'react';
import { maskPan } from '@/utils/card';

// Smart formatting function for request/response data
const formatRequestResponse = (data: any): string => {
  if (!data) return '';
  
  // Handle string data (like XML SOAP)
  if (typeof data === 'string') {
    // Check if it's XML
    if (data.trim().startsWith('<')) {
      // Minify XML - remove excessive whitespace but keep structure
      return data
        .replace(/>\s+</g, '><')          // Remove whitespace between tags
        .replace(/\n\s+/g, '\n')          // Remove excessive indentation
        .replace(/\s{2,}/g, ' ')          // Replace multiple spaces with single space
        .trim();
    }
    return data;
  }
  
  // Handle object data (JSON)
  if (typeof data === 'object') {
    try {
      // Compact JSON formatting
      const jsonStr = JSON.stringify(data, null, 1);
      // Further compress by removing some whitespace
      return jsonStr
        .replace(/\n\s+/g, '\n  ')        // Reduce indentation
        .replace(/,\n\s+}/g, '\n}')       // Clean up closing braces
        .replace(/{\n\s+/g, '{ ')         // Compact opening braces for small objects
        .replace(/\[\n\s+/g, '[ ')        // Compact opening brackets for small arrays
        .replace(/\n\s+]/g, ' ]');        // Compact closing brackets
    } catch (e) {
      return String(data);
    }
  }
  
  return String(data);
};

interface LiveStep {
  time: string;
  name: string;
  status: string;
  message?: string;
  seq?: number;
  request?: any;
  response?: any;
}

interface LiveStepsProps {
  steps: LiveStep[];
  isRunning: boolean;
}

const LiveSteps: React.FC<LiveStepsProps> = ({ steps, isRunning }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const lastStepCountRef = useRef(0);

  // Filter out preparation/ready steps
  const filteredSteps = steps.filter(step => {
    const name = step.name.toLowerCase();
    return !(name.includes('hazır') || name.includes('ready') || name.includes('prepared') || 
             name.includes('soap hazır') || name.includes('preparing') || name.includes('setup'));
  });

  // Auto-scroll yeni adım geldiğinde
  useEffect(() => {
    if (filteredSteps.length > lastStepCountRef.current && autoScroll && containerRef.current) {
      const container = containerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
    lastStepCountRef.current = filteredSteps.length;
  }, [filteredSteps.length, autoScroll]);

  // Manuel scroll yapıldığında auto-scroll'u durdur
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setAutoScroll(isAtBottom);
    }
  };

  // Adım durumunu düzelt - running olan sonraki adım varsa öncekini success yap
  const getCorrectStatus = (step: LiveStep, index: number) => {
    if (step.status === 'running' && index < filteredSteps.length - 1) {
      // Bu adım running ama sonrasında adım var, demek ki tamamlanmış
      // Eğer mesajında error varsa error, yoksa success
      const hasError = step.message?.toLowerCase().includes('error') || 
                      step.message?.toLowerCase().includes('hata') ||
                      step.message?.toLowerCase().includes('fail');
      return hasError ? 'error' : 'success';
    }
    return step.status;
  };

  // Accordion toggle
  const toggleExpand = (stepKey: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepKey)) {
        newSet.delete(stepKey);
      } else {
        newSet.add(stepKey);
      }
      return newSet;
    });
  };

  // Kart numarasını çıkar
  const extractCardNumber = (step: LiveStep) => {
    const req = (step as any).request;
    const res = (step as any).response;
    
    if (req?.cardNumber) return String(req.cardNumber);
    if (req?.pan) return String(req.pan);
    if (res?.maskedCard) return String(res.maskedCard);
    if (res?.cardNumber) return String(res.cardNumber);
    return null;
  };

  // Payment ID'yi çıkar
  const extractPaymentId = (step: LiveStep) => {
    const req = (step as any).request;
    const res = (step as any).response;
    
    if (res?.paymentId) return String(res.paymentId);
    if (req?.paymentId) return String(req.paymentId);
    return null;
  };

  // Adım ismini iyileştir
  const improveStepName = (step: LiveStep) => {
    const originalName = step.name;
    
    // Token alma işlemleri
    if (originalName.toLowerCase().includes('token') || originalName.toLowerCase().includes('secure')) {
      return 'Token Alma Süreci';
    }
    
    // Ödeme işlemleri
    if (originalName.toLowerCase().includes('payment') || originalName.toLowerCase().includes('odeme') || originalName.toLowerCase().includes('pay')) {
      return 'Ödeme Süreci';
    }
    
    // İptal işlemleri
    if (originalName.toLowerCase().includes('cancel') || originalName.toLowerCase().includes('iptal')) {
      return 'İptal Süreci';
    }
    
    // İade işlemleri
    if (originalName.toLowerCase().includes('refund') || originalName.toLowerCase().includes('iade')) {
      return 'İade Süreci';
    }
    
    // Doğrulama işlemleri
    if (originalName.toLowerCase().includes('verify') || originalName.toLowerCase().includes('dogrula')) {
      return 'Doğrulama';
    }
    
    // OTP işlemleri
    if (originalName.toLowerCase().includes('otp') || originalName.toLowerCase().includes('sms')) {
      return 'OTP Gönderimi';
    }
    
    // Sonuç kontrolü
    if (originalName.toLowerCase().includes('sonuc') || originalName.toLowerCase().includes('result') || originalName.toLowerCase().includes('query')) {
      return 'Sonuç Kontrolü';
    }
    
    return originalName;
  };

  // Adımdan önemli bilgileri çıkarma
  const extractStepInfo = (step: LiveStep): string => {
    try {
      const stepStr = JSON.stringify(step);
      
      // Token değeri
      const tokenMatch = stepStr.match(/"(?:token|cardToken|hashData)"\s*:\s*"([^"]{8,})"/i);
      if (tokenMatch) {
        return `Token: ${tokenMatch[1].slice(0, 12)}...`;
      }
      
      // Payment/Order ID
      const paymentMatch = stepStr.match(/"(?:paymentId|orderId|transactionId)"\s*:\s*"?([^",\s]+)"?/i);
      if (paymentMatch) {
        return `ID: ${paymentMatch[1]}`;
      }
      
      // Kart numarası
      const cardMatch = stepStr.match(/"(?:cardNo|creditCardNo|pan)"\s*:\s*"([45]\d{6})/i);
      if (cardMatch) {
        return `Kart: ${maskPan(cardMatch[1] + '000000000')}`;
      }
      
      // Tutar
      const amountMatch = stepStr.match(/"(?:amount|tutar|refundAmount)"\s*:\s*"?([0-9.]+)"?/i);
      if (amountMatch) {
        return `${amountMatch[1]} TL`;
      }
      
      // Response code
      const codeMatch = stepStr.match(/"(?:responseCode|code|resultCode)"\s*:\s*"?([^",\s]+)"?/i);
      if (codeMatch && codeMatch[1] !== '0') {
        return `Code: ${codeMatch[1]}`;
      }
      
      // Status mesajı
      if (step.message && step.message.includes('başarılı')) {
        return 'Başarılı';
      }
      if (step.message && step.message.includes('hata')) {
        return 'Hata';
      }
      
      return '';
    } catch {
      return '';
    }
  };

  // Status rengini al
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-emerald-400 border-emerald-500 bg-emerald-500/20';
      case 'error':
        return 'text-red-400 border-red-500 bg-red-500/20';
      case 'running':
        return 'text-amber-400 border-amber-500 bg-amber-500/20 animate-pulse';
      default:
        return 'text-neutral-400 border-neutral-500 bg-neutral-500/20';
    }
  };

  // Icon'u al
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'running':
        return '⟳';
      default:
        return '◦';
    }
  };

  if (!filteredSteps.length) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            🚀 Canlı Test Adımları
          </h3>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <div className="h-1.5 w-1.5 rounded-full bg-neutral-600"></div>
            Bekliyor
          </div>
        </div>
        
        <div className="relative rounded-lg border border-dashed border-neutral-700 bg-gradient-to-br from-neutral-900/50 to-neutral-800/30 p-6">
          <div className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <span className="text-xl">⚡</span>
            </div>
            <p className="text-sm text-neutral-400">Test başlamadı...</p>
            <p className="text-xs text-neutral-500 mt-1">Sihirbazdan test başlatın</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-700 bg-gradient-to-r from-neutral-900/80 to-neutral-800/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className={`relative h-8 w-8 rounded-full flex items-center justify-center ${
            isRunning 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/30' 
              : 'bg-gradient-to-r from-neutral-600 to-neutral-700'
          }`}>
            {isRunning ? (
              <svg className="w-4 h-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isRunning && (
              <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-30"></div>
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-100">
              {isRunning ? 'Test Çalışıyor' : 'Test Tamamlandı'}
            </h3>
            <p className="text-xs text-neutral-400">
              Canlı adım takibi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-green-400 font-medium">
              {filteredSteps.filter(s => getCorrectStatus(s, filteredSteps.findIndex(st => st === s)) === 'success').length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500"></div>
            <span className="text-red-400 font-medium">
              {filteredSteps.filter(s => getCorrectStatus(s, filteredSteps.findIndex(st => st === s)) === 'error').length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500"></div>
            <span className="text-amber-400 font-medium">
              {filteredSteps.filter(s => getCorrectStatus(s, filteredSteps.findIndex(st => st === s)) === 'running').length}
            </span>
          </div>
          <div className="text-neutral-400 text-xs">
            {filteredSteps.length} adım
          </div>
        </div>
      </div>

      {/* Enhanced Steps Timeline */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-96 overflow-y-auto space-y-2 p-4 rounded-lg border border-neutral-700 bg-gradient-to-br from-neutral-900/50 to-neutral-800/30 backdrop-blur-sm"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#374151 #1f2937'
        }}
      >
        {filteredSteps.map((step, index) => {
          const correctedStatus = getCorrectStatus(step, index);
          const displayName = improveStepName(step);
          const stepInfo = extractStepInfo(step);
          const isLastStep = index === filteredSteps.length - 1;
          
          return (
            <div
              key={`${step.seq}-${step.time}-${index}`}
              className={`
                relative group rounded-lg border transition-all duration-300 hover:shadow-lg
                ${correctedStatus === 'success' ? 'border-green-500/30 bg-gradient-to-r from-green-500/5 to-green-600/10 hover:border-green-500/50' : ''}
                ${correctedStatus === 'error' ? 'border-red-500/30 bg-gradient-to-r from-red-500/5 to-red-600/10 hover:border-red-500/50' : ''}
                ${correctedStatus === 'running' ? 'border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-amber-600/10 hover:border-amber-500/50' : ''}
                ${isLastStep && isRunning ? 'animate-slide-in-from-bottom-4' : ''}
              `}
            >
              {/* Timeline Connector */}
              {index < filteredSteps.length - 1 && (
                <div className="absolute left-6 top-12 w-0.5 h-4 bg-gradient-to-b from-neutral-600 to-transparent"></div>
              )}
              
              <div className="flex items-center gap-4 p-4">
                {/* Status Icon with Enhanced Design */}
                <div className={`
                  relative flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all duration-200
                  ${correctedStatus === 'success' ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/30' : ''}
                  ${correctedStatus === 'error' ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/30' : ''}
                  ${correctedStatus === 'running' ? 'bg-amber-500 border-amber-400 shadow-lg shadow-amber-500/30 animate-pulse' : ''}
                `}>
                  {correctedStatus === 'success' && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {correctedStatus === 'error' && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {correctedStatus === 'running' && (
                    <svg className="w-3 h-3 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </div>
                
                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-neutral-100 text-sm truncate">
                      {displayName}
                    </h4>
                    <span className="text-xs text-neutral-500 flex-shrink-0 ml-2">
                      {new Date(step.time).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  {/* Step Info and Message */}
                  <div className="flex flex-wrap items-center gap-2">
                    {stepInfo && (
                      <span className={`
                        text-xs px-2 py-1 rounded-full font-medium
                        ${correctedStatus === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : ''}
                        ${correctedStatus === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : ''}
                        ${correctedStatus === 'running' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : ''}
                      `}>
                        {stepInfo}
                      </span>
                    )}
                    
                    {step.message && (
                      <span className="text-xs text-neutral-400 truncate max-w-xs">
                        {step.message}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Progress Indicator */}
                <div className="flex-shrink-0 text-xs text-neutral-500">
                  {index + 1}/{filteredSteps.length}
                </div>
              </div>
              
              {/* Hover Effect Overlay */}
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-neutral-700/0 to-neutral-600/0 group-hover:from-neutral-700/5 group-hover:to-neutral-600/5 transition-all duration-200 pointer-events-none"></div>
            </div>
          );
        })}
      </div>

      {/* Enhanced Footer with Progress Bar */}
      {filteredSteps.length > 0 && (
        <div className="p-4 rounded-lg border border-neutral-700 bg-gradient-to-r from-neutral-900/50 to-neutral-800/30 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-neutral-400">Süre:</span>
              <span className="text-neutral-200 font-mono">
                {filteredSteps.length > 0 ? 
                  Math.round((new Date(filteredSteps[filteredSteps.length - 1].time).getTime() - new Date(filteredSteps[0].time).getTime()) / 1000) 
                  : 0}s
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              {isRunning ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  İşlem devam ediyor...
                </>
              ) : (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-neutral-500"></div>
                  Tamamlandı
                </>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-neutral-700/50 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                isRunning 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              }`}
              style={{ 
                width: `${filteredSteps.length > 0 ? ((filteredSteps.filter(s => getCorrectStatus(s, filteredSteps.findIndex(st => st === s)) !== 'running').length) / filteredSteps.length) * 100 : 0}%` 
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveSteps;
