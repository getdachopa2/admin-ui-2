// src/components/wizard/StepCancelRefund.tsx
import { useState } from 'react';
import CandidateFinder from '@/components/CandidateFinder';

export interface StepCancelRefundValue {
  selectedAction?: 'cancel' | 'refund';
  selectedCandidate?: { paymentId: string } | null;
}

interface StepCancelRefundProps {
  value: StepCancelRefundValue;
  onChange: (value: StepCancelRefundValue) => void;
  channelId: string;
  scenarios: string[];
}

export default function StepCancelRefund({ value, onChange, channelId, scenarios }: StepCancelRefundProps) {
  const hasCancel = scenarios.includes('CANCEL');
  const hasRefund = scenarios.includes('REFUND');
  const hasPayment = scenarios.some(s => s.startsWith('PAYMENT')) || scenarios.includes('ALL');
  const isCancelRefundOnly = (hasCancel || hasRefund) && !hasPayment && scenarios.length === 1;
  
  // Default to cancel if available
  const [openAccordion, setOpenAccordion] = useState<'cancel' | 'refund' | null>(
    hasCancel ? 'cancel' : hasRefund ? 'refund' : null
  );

  if (!hasCancel && !hasRefund) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">İptal / İade Seçimi</h2>
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
          İptal veya İade senaryosu seçilmediği için bu adım atlanıyor.
        </div>
      </div>
    );
  }

  const handleAccordionToggle = (action: 'cancel' | 'refund') => {
    const newOpenState = openAccordion === action ? null : action;
    setOpenAccordion(newOpenState);
    
    // Sadece yeni bir accordion açıldığında action'ı değiştir
    if (newOpenState) {
      onChange({ ...value, selectedAction: action });
    }
  };

  const handleCandidateSelection = (candidate: any) => {
    onChange({ 
      ...value, 
      selectedCandidate: { paymentId: candidate.paymentId }
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className={`text-lg font-semibold ${isCancelRefundOnly ? 'text-orange-400' : ''}`}>
          İptal / İade Seçimi
        </h2>
        <p className="text-sm text-neutral-400">
          {isCancelRefundOnly 
            ? 'Mevcut başarılı ödemelerden birini seçerek iptal/iade işlemi gerçekleştirin.'
            : 'İşlem türünü seçin ve mevcut bir ödeme ile eşleştirin.'
          }
        </p>
        {isCancelRefundOnly && (
          <div className="mt-2 p-3 bg-orange-950/30 border border-orange-800/30 rounded-lg text-sm text-orange-300">
            Sadece iptal/iade modu: Yeni ödeme yapılmayacak, mevcut işlem üzerinde çalışılacak.
          </div>
        )}
      </header>

      <div className="space-y-3">
        {/* İptal Accordion */}
        {hasCancel && (
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <button
              onClick={() => handleAccordionToggle('cancel')}
              className="w-full px-4 py-3 text-left flex items-center justify-between bg-neutral-900 hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-red-400 font-medium">İptal</span>
                {value.selectedAction === 'cancel' && value.selectedCandidate?.paymentId && (
                  <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300">
                    Payment ID: {value.selectedCandidate.paymentId}
                  </span>
                )}
              </div>
              <span className="text-neutral-400">
                {openAccordion === 'cancel' ? '−' : '+'}
              </span>
            </button>
            
            {openAccordion === 'cancel' && (
              <div className="p-4 max-h-96 overflow-auto">
                <CandidateFinder
                  action="cancel"
                  channelId={channelId}
                  onPick={handleCandidateSelection}
                />
              </div>
            )}
          </div>
        )}

        {/* İade Accordion */}
        {hasRefund && (
          <div className="rounded-lg border border-neutral-800 overflow-hidden">
            <button
              onClick={() => handleAccordionToggle('refund')}
              className="w-full px-4 py-3 text-left flex items-center justify-between bg-neutral-900 hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-amber-400 font-medium">İade</span>
                {value.selectedAction === 'refund' && value.selectedCandidate?.paymentId && (
                  <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300">
                    Payment ID: {value.selectedCandidate.paymentId}
                  </span>
                )}
              </div>
              <span className="text-neutral-400">
                {openAccordion === 'refund' ? '−' : '+'}
              </span>
            </button>
            
            {openAccordion === 'refund' && (
              <div className="p-4 max-h-96 overflow-auto">
                <CandidateFinder
                  action="refund"
                  channelId={channelId}
                  onPick={handleCandidateSelection}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
