// src/components/wizard/Wizard.tsx
import { useState, useMemo } from 'react';
import StepScenario from './StepScenario';
import StepEnvChannel from './StepEnvChannel';
import StepApplication from './StepApplication';
import StepCards from './StepCards';
import StepCancelRefund, { type StepCancelRefundValue } from './StepCancelRefund';
import StepPayment from './StepPayment';
import StepSummary from './StepSummary';
import type { WizardData, Scenario, ManualCard, PaymentState } from '@/types/n8n';

const STEPS = [
  { key: 'scenario', title: 'Senaryo' },
  { key: 'env',      title: 'Ortam & Kanal' },
  { key: 'app',      title: 'Uygulama Bilgileri' },
  { key: 'cards',    title: 'Kart / Test Verisi' },
  { key: 'cr',       title: 'İptal / İade' },
  { key: 'payment',  title: 'Ödeme Bilgileri' },
  { key: 'summary',  title: 'Özet & Çalıştır' },
] as const;

type StepKey = typeof STEPS[number]['key'];

interface WizardProps {
  onComplete: (payload: any) => Promise<void>;
  onCancel: () => void;
}

export default function Wizard({ onComplete, onCancel }: WizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [data, setData] = useState<WizardData>({ 
    scenarios: [],
    cardSelectionMode: 'automatic',
    manualCards: [],
    cardCount: 10,
    payment: {
      userId: '',
      userName: '',
      threeDOperation: false,
      installmentNumber: 0,
      amount: 10,
      msisdn: '5303589836',
      paymentType: 'CREDITCARD',
      options: {
        includeMsisdnInOrderID: false,
        checkCBBLForMsisdn: true,
        checkCBBLForCard: true,
        checkFraudStatus: false,
      },
    }
  });

  // Görünürlük kuralları senaryoya göre
  const visibleSteps = useMemo(() => {
    const selectedScenarios = data.scenarios || [];
    
    // İptal veya iade sadece seçildiyse (ALL olmadan)
    const isOnlyCancel = selectedScenarios.includes('CANCEL') && !selectedScenarios.includes('ALL') && !selectedScenarios.some(s => s.startsWith('PAYMENT'));
    const isOnlyRefund = selectedScenarios.includes('REFUND') && !selectedScenarios.includes('ALL') && !selectedScenarios.some(s => s.startsWith('PAYMENT'));
    const isCancelRefundOnly = (isOnlyCancel || isOnlyRefund) && selectedScenarios.length === 1;
    
    if (isCancelRefundOnly) {
      // Sadece iptal/iade seçildiyse kart ve ödeme adımlarını gizle
      return STEPS.filter(step => 
        step.key !== 'cards' && step.key !== 'payment'
      );
    }
    
    // Diğer durumlarda tüm adımları göster
    return STEPS;
  }, [data.scenarios]);

  const current = visibleSteps[stepIndex]?.key;

  const updateData = (key: keyof WizardData, value: any) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const goNext = () => {
    if (stepIndex < visibleSteps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const goToStep = (targetIndex: number) => {
    if (targetIndex >= 0 && targetIndex < visibleSteps.length) {
      setStepIndex(targetIndex);
    }
  };

  // Validation - İleri butonu aktif olabilir mi?
  const canNext = useMemo(() => {
    const selectedScenarios = data.scenarios || [];
    const isOnlyCancel = selectedScenarios.includes('CANCEL') && !selectedScenarios.includes('ALL') && !selectedScenarios.some(s => s.startsWith('PAYMENT'));
    const isOnlyRefund = selectedScenarios.includes('REFUND') && !selectedScenarios.includes('ALL') && !selectedScenarios.some(s => s.startsWith('PAYMENT'));
    const isCancelRefundOnly = (isOnlyCancel || isOnlyRefund) && selectedScenarios.length === 1;

    switch (current) {
      case 'scenario':
        return data.scenarios && data.scenarios.length > 0;
      case 'env':
        return data.env && data.channelId;
      case 'app':
        return data.application?.applicationName && data.application?.applicationPassword;
      case 'cards':
        // İptal/iade only durumunda bu adım gizli, validation gerekmiyor
        if (isCancelRefundOnly) return true;
        return data.cardSelectionMode === 'automatic' || 
               (data.cardSelectionMode === 'manual' && data.manualCards && data.manualCards.length > 0);
      case 'cr':
        // İptal/iade only durumunda candidate seçilmesi zorunlu
        if (isCancelRefundOnly) {
          return data.cancelRefund?.selectedCandidate?.paymentId;
        }
        return true; // Diğer durumlarda opsiyonel
      case 'payment':
        // İptal/iade only durumunda bu adım gizli, validation gerekmiyor
        if (isCancelRefundOnly) return true;
        return data.payment?.msisdn && data.payment?.amount;
      case 'summary':
        return true;
      default:
        return false;
    }
  }, [current, data]);

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        {visibleSteps.map((s, i) => {
          const active = i === stepIndex;
          const completed = i < stepIndex;
          return (
            <button
              key={s.key}
              onClick={() => goToStep(i)}
              className={`px-2 py-1 rounded-lg text-xs border transition-colors hover:opacity-80
                ${active 
                  ? 'border-primary text-primary bg-primary/10' 
                  : completed
                    ? 'border-green-600 text-green-400 bg-green-600/10 hover:bg-green-600/20'
                    : 'border-base-800 text-base-400 hover:border-base-600 hover:text-base-300'
                }`}
            >
              {i + 1}. {s.title}
            </button>
          );
        })}
      </div>

      {/* Step body */}
      <div className="card p-3">
        {current === 'scenario' && (
          <StepScenario
            value={data.scenarios}
            onChange={(v: Scenario[]) => updateData('scenarios', v)}
          />
        )}

        {current === 'env' && (
          <StepEnvChannel
            value={{ env: data.env || 'stb', channelId: data.channelId || '' }}
            onChange={(v) => {
              updateData('env', v.env);
              updateData('channelId', v.channelId);
            }}
          />
        )}

        {current === 'app' && (
          <StepApplication
            value={data.application || {
              applicationName: '',
              applicationPassword: '',
              secureCode: '',
              transactionId: '',
              transactionDateTime: ''
            }}
            onChange={(v) => updateData('application', v)}
          />
        )}

        {current === 'cards' && (
          <StepCards
            manualMode={data.cardSelectionMode === 'manual'}
            setManualMode={(v) => updateData('cardSelectionMode', v ? 'manual' : 'automatic')}
            manualCards={data.manualCards || []}
            addCard={() => {
              const newCards = [...(data.manualCards || []), {
                ccno: '',
                e_month: '',
                e_year: '',
                cvv: '',
                bank_code: ''
              }];
              updateData('manualCards', newCards);
            }}
            removeCard={(index) => {
              const newCards = (data.manualCards || []).filter((_, i) => i !== index);
              updateData('manualCards', newCards);
            }}
            updateCard={(index, key, value) => {
              const newCards = [...(data.manualCards || [])];
              if (newCards[index]) {
                newCards[index] = { ...newCards[index], [key]: value };
                updateData('manualCards', newCards);
              }
            }}
            manualValid={true} // Simplified validation for now
          />
        )}

        {current === 'cr' && (
          <StepCancelRefund
            value={data.cancelRefund || {}}
            onChange={(v: StepCancelRefundValue) => updateData('cancelRefund', v)}
            channelId={data.channelId || ''}
            scenarios={data.scenarios || []}
          />
        )}

        {current === 'payment' && (
          <StepPayment
            value={data.payment || {
              userId: '',
              userName: '',
              threeDOperation: false,
              installmentNumber: 0,
              amount: 10,
              msisdn: '',
              paymentType: 'CREDITCARD',
              options: {
                includeMsisdnInOrderID: false,
                checkCBBLForMsisdn: true,
                checkCBBLForCard: true,
                checkFraudStatus: false,
              },
            }}
            onChange={(v: PaymentState) => updateData('payment', v)}
          />
        )}

        {current === 'summary' && (
          <StepSummary
            fields={{
              'Senaryolar': data.scenarios?.join(', ') || '',
              'Run Mode': (() => {
                const scenarios = data.scenarios || [];
                return scenarios.includes('ALL') ? 'all' : 
                       scenarios.some((s: string) => ['CANCEL', 'REFUND'].includes(s)) ? 'all' :
                       'payment-only';
              })(),
              'Ana Aksiyon': (() => {
                const scenarios = data.scenarios || [];
                if (scenarios.includes('CANCEL')) return 'cancel';
                if (scenarios.includes('REFUND')) return 'refund';
                return 'payment';
              })(),
              'Ortam': data.env || '',
              'Kanal ID': data.channelId || '',
              'Uygulama': data.application?.applicationName || '',
              'Uygulama Şifresi': data.application?.applicationPassword || '',
              'Secure Code': data.application?.secureCode || '',
              'Transaction ID': data.application?.transactionId || '(otomatik)',
              'Transaction DateTime': data.application?.transactionDateTime || '(otomatik)',
              'Kart Modu': data.cardSelectionMode || '',
              'Manuel Kartlar': data.manualCards?.length ? `${data.manualCards.length} kart seçili` : '',
              'Tutar': data.payment?.amount?.toString() || '',
              'MSISDN': data.payment?.msisdn || '',
              'Taksit': data.payment?.installmentNumber?.toString() || '0 (peşin)',
              'User ID': data.payment?.userId || '',
              'User Name': data.payment?.userName || '',
              'İptal/İade Aksiyonu': data.cancelRefund?.selectedAction || 'Yok',
              'İptal/İade Payment ID': data.cancelRefund?.selectedCandidate?.paymentId || 'Yok',
            }}
            tableData={[]}
            showTable={false}
            flags={data.payment?.options ? {
              'includeMsisdnInOrderID': data.payment.options.includeMsisdnInOrderID,
              'checkCBBLForMsisdn': data.payment.options.checkCBBLForMsisdn,
              'checkCBBLForCard': data.payment.options.checkCBBLForCard,
              'checkFraudStatus': data.payment.options.checkFraudStatus,
            } : {}}
          />
        )}
      </div>

      {/* Step footer */}
      <div className="flex items-center justify-between">
        <button className="btn-outline text-sm px-3 py-1" onClick={stepIndex === 0 ? onCancel : goPrev}>
          {stepIndex === 0 ? 'İptal' : '‹ Geri'}
        </button>
        <div className="text-xs text-base-400">
          Adım {stepIndex + 1}/{visibleSteps.length}
        </div>
        {stepIndex === visibleSteps.length - 1 ? (
          <button 
            className="btn text-sm px-3 py-1" 
            onClick={() => onComplete(data)}
            disabled={!canNext}
          >
            Test Başlat
          </button>
        ) : (
          <button className="btn text-sm px-3 py-1" onClick={goNext} disabled={!canNext}>
            İleri ›
          </button>
        )}
      </div>

      {/* Collapsible Debug JSON */}
      <div className="border-t border-neutral-800 pt-3">
        <button 
          className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-300"
          onClick={() => setShowDebug(!showDebug)}
        >
          <span>{showDebug ? '▼' : '▶'}</span>
          Debug Data
        </button>
        {showDebug && (
          <pre className="mt-2 text-xs text-base-400 bg-neutral-900/50 p-2 rounded overflow-auto max-h-48">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
