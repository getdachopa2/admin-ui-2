// src/components/wizard/StepScenario.tsx
import { useMemo } from 'react';
import type { Scenario } from '@/types/n8n';

const SCENARIOS: { key: Scenario; title: string; desc: string; icon: string }[] = [
  { key: 'ALL',              title: 'Hepsi (Full Suite)',       desc: 'Payment + Cancel + Refund akışlarını sırayla çalıştırır.', icon: '∞' },
  { key: 'PAYMENT_3DS_OFF',  title: 'Ödeme (3D Off)',          desc: 'Token + 3DSiz ödeme akışı.', icon: '$' },
  { key: 'CANCEL',           title: 'İptal',                    desc: 'Mevcut başarılı ödemeleri iptal eder.', icon: '×' },
  { key: 'REFUND',           title: 'İade',                     desc: 'Mevcut başarılı ödemeleri iade eder.', icon: '↺' },
];

export default function StepScenario({
  value,
  onChange,
}: {
  value: Scenario[];
  onChange: (v: Scenario[]) => void;
}) {
  const selectedScenarios = value || [];

  const toggleScenario = (scenario: Scenario) => {
    if (scenario === 'ALL') {
      // ALL seçilirse diğerlerini temizle
      onChange(selectedScenarios.includes('ALL') ? [] : ['ALL']);
    } else {
      // Diğer senaryolar için toggle
      const filtered = selectedScenarios.filter(s => s !== 'ALL'); // ALL'ı kaldır
      if (filtered.includes(scenario)) {
        onChange(filtered.filter(s => s !== scenario));
      } else {
        onChange([...filtered, scenario]);
      }
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">Senaryo Seçimi</h2>
        <p className="text-sm text-neutral-400">
          Test etmek istediğiniz senaryoları seçin. Multiple seçim yapabilirsiniz.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {SCENARIOS.map((s) => {
          const isSelected = selectedScenarios.includes(s.key);
          return (
            <label
              key={s.key}
              className={`group relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-lg ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/5 shadow-emerald-500/20'
                  : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
              }`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                className="sr-only"
                checked={isSelected}
                onChange={() => toggleScenario(s.key)}
              />
              
              {/* Content */}
              <div className="flex items-start gap-3">
                <div className="text-2xl">{s.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-white">{s.title}</h3>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'border-emerald-500 bg-emerald-500' 
                        : 'border-neutral-500 group-hover:border-neutral-400'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">{s.desc}</p>
                  
                  {/* Tag */}
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      isSelected 
                        ? 'bg-emerald-500/20 text-emerald-300' 
                        : 'bg-neutral-700 text-neutral-400'
                    }`}>
                      {s.key}
                    </span>
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Seçim özeti */}
      {selectedScenarios.length > 0 && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-700/10 p-3">
          <div className="text-sm text-emerald-300">
            <span className="font-medium">Seçili senaryolar:</span> {selectedScenarios.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
