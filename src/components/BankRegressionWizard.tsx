import { useState, useMemo } from 'react';

interface BankRegressionWizardData {
  environment: 'STB' | 'PRP';
  selectedBanks: string[];
  scenario: string;
  cardStrategy: 'automatic' | 'manual';
  parametersPresetId?: number;
  estimatedDuration?: string;
}

const BANKS = [
  { name: 'AKBANK', channelId: '999046', bankCode: '046', status: 'active' },
  { name: 'DENİZBANK', channelId: '999134', bankCode: '134', status: 'warning' },
  { name: 'GARANTİ', channelId: '999062', bankCode: '062', status: 'active' },
  { name: 'VAKIFBANK', channelId: '999015', bankCode: '015', status: 'error' },
  { name: 'KUVEYT', channelId: '999205', bankCode: '205', status: 'active' },
  { name: 'HALKBANK', channelId: '999012', bankCode: '012', status: 'pending' },
  { name: 'İŞBANK', channelId: '999064', bankCode: '064', status: 'pending' },
  { name: 'ZIRAAT', channelId: '999010', bankCode: '010', status: 'pending' },
  { name: 'QNB FİNANS', channelId: '999111', bankCode: '111', status: 'pending' },
  { name: 'YAPIKRED', channelId: '999067', bankCode: '067', status: 'pending' },
];

const SCENARIOS = [
  { value: 'sale', label: 'Sadece Satış', description: 'Tek ödeme işlemi' },
  { value: 'cancel', label: 'Sadece İptal', description: 'Sadece iptal işlemleri' },
  { value: 'refund', label: 'Sadece İade', description: 'Sadece iade işlemleri' },
  { value: 'all', label: 'Tam Regresyon', description: 'Satış + İptal + İade' },
];

const STEPS = [
  { key: 'banks', title: 'Banka & Ortam' },
  { key: 'scenario', title: 'Senaryo' },
  { key: 'cards', title: 'Kart Seçimi' },
  { key: 'summary', title: 'Özet & Çalıştır' },
] as const;

type StepKey = typeof STEPS[number]['key'];

interface BankRegressionWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BankRegressionWizardData) => void;
}

export default function BankRegressionWizard({ open, onClose, onSubmit }: BankRegressionWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<BankRegressionWizardData>({
    environment: 'STB',
    selectedBanks: [],
    scenario: '',
    cardStrategy: 'automatic',
  });

  const updateData = (updates: Partial<BankRegressionWizardData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const current = STEPS[stepIndex]?.key;

  const canNext = useMemo(() => {
    switch (current) {
      case 'banks':
        return data.selectedBanks.length > 0;
      case 'scenario':
        return data.scenario !== '';
      case 'cards':
        return true;
      case 'summary':
        return true;
      default:
        return false;
    }
  }, [current, data]);

  const estimatedDuration = useMemo(() => {
    if (data.selectedBanks.length === 0) return '';
    const baseTime = data.selectedBanks.length * 2;
    const scenarioMultiplier = data.scenario === 'sale' ? 1 : 
                              data.scenario === 'cancel' ? 1.2 : 
                              data.scenario === 'refund' ? 1.3 :
                              data.scenario === 'all' ? 2.5 : 1;
    const totalMinutes = Math.ceil(baseTime * scenarioMultiplier);
    return `${totalMinutes}-${totalMinutes + 2} dakika`;
  }, [data.selectedBanks.length, data.scenario]);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const handleSubmit = () => {
    onSubmit({ ...data, estimatedDuration });
    onClose();
  };

  const handleBankToggle = (bankName: string) => {
    const newSelected = data.selectedBanks.includes(bankName)
      ? data.selectedBanks.filter(b => b !== bankName)
      : [...data.selectedBanks, bankName];
    updateData({ selectedBanks: newSelected });
  };

  const handleSelectAllBanks = () => {
    const activeBanks = BANKS.filter(bank => bank.status !== 'pending').map(bank => bank.name);
    updateData({ selectedBanks: activeBanks });
  };

  const handleClearAllBanks = () => {
    updateData({ selectedBanks: [] });
  };

  const getBankStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400';
      case 'warning': return 'text-orange-400';
      case 'error': return 'text-red-400';
      case 'pending': return 'text-neutral-400';
      default: return 'text-neutral-400';
    }
  };

  const getBankStatusText = (status: string) => {
    switch (status) {
      case 'active': return '✓ Aktif';
      case 'warning': return '⚠ Uyarı';
      case 'error': return '✗ Hata';
      case 'pending': return '○ Beklemede';
      default: return '○ Bilinmeyen';
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white flex items-center">
            <i className="fas fa-rocket mr-2"></i>
            Banka Regresyon Testi Başlat
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 flex-wrap p-4 border-b border-neutral-800">
          {STEPS.map((step, idx) => (
            <div
              key={step.key}
              className={`flex items-center gap-2 rounded-xl px-3 py-1 text-xs font-medium transition-colors ${
                idx === stepIndex
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : idx < stepIndex
                  ? 'bg-neutral-700 text-neutral-300'
                  : 'bg-neutral-800 text-neutral-500'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                idx < stepIndex ? 'bg-emerald-500 text-white' : 'bg-neutral-600'
              }`}>
                {idx < stepIndex ? '✓' : idx + 1}
              </span>
              {step.title}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="p-4 overflow-y-auto max-h-96">
          {current === 'banks' && (
            <div className="space-y-4">
              <header>
                <h2 className="text-base font-semibold">Banka ve Ortam Seçimi</h2>
                <p className="text-xs text-neutral-400">
                  Test edilecek bankalar ve ortam seçimi yapın.
                </p>
              </header>

              {/* Environment Selection */}
              <div>
                <label className="block text-xs font-medium mb-2 text-neutral-500">Test Ortamı</label>
                <div className="flex gap-3">
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="environment" 
                      value="STB" 
                      checked={data.environment === 'STB'}
                      onChange={(e) => updateData({ environment: e.target.value as 'STB' | 'PRP' })}
                      className="mr-2" 
                    />
                    <span className="bg-orange-500/15 text-orange-300 px-2 py-1 rounded-full text-xs">STB (Test)</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="environment" 
                      value="PRP" 
                      checked={data.environment === 'PRP'}
                      onChange={(e) => updateData({ environment: e.target.value as 'STB' | 'PRP' })}
                      className="mr-2" 
                    />
                    <span className="bg-red-500/15 text-red-300 px-2 py-1 rounded-full text-xs">PRP (Canlı)</span>
                  </label>
                </div>
              </div>

              {/* Bank Selection */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-medium text-neutral-500">Banka Seçimi</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSelectAllBanks}
                      className="text-neutral-400 hover:text-white text-xs"
                    >
                      Aktif Bankaları Seç
                    </button>
                    <button 
                      onClick={handleClearAllBanks}
                      className="text-neutral-400 hover:text-white text-xs"
                    >
                      Temizle
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {BANKS.map((bank) => (
                    <label 
                      key={bank.name}
                      className={`cursor-pointer rounded-lg border-2 p-3 transition-all duration-200 hover:shadow-lg ${
                        data.selectedBanks.includes(bank.name)
                          ? 'border-emerald-500 bg-emerald-500/5 shadow-emerald-500/20'
                          : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
                      } ${bank.status === 'pending' ? 'opacity-50' : ''}`}
                    >
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={data.selectedBanks.includes(bank.name)}
                        onChange={() => handleBankToggle(bank.name)}
                        disabled={bank.status === 'pending'}
                      />
                      <div className="text-center">
                        <div className="text-sm font-bold mb-1">{bank.name}</div>
                        <div className="text-xs text-neutral-400">Kanal: {bank.channelId}</div>
                        <div className={`text-xs ${getBankStatusColor(bank.status)}`}>
                          {getBankStatusText(bank.status)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Selection Summary */}
              <div className="rounded-lg border border-emerald-700/40 bg-emerald-700/10 p-3">
                <div className="text-xs text-emerald-300">
                  <span className="font-medium">Seçili bankalar:</span> {data.selectedBanks.length} adet
                  {data.selectedBanks.length > 0 && (
                    <> - {data.selectedBanks.join(', ')}</>
                  )}
                </div>
              </div>
            </div>
          )}

          {current === 'scenario' && (
            <div className="space-y-4">
              <header>
                <h2 className="text-base font-semibold">Senaryo Seçimi</h2>
                <p className="text-xs text-neutral-400">
                  Test etmek istediğiniz senaryoyu seçin.
                </p>
              </header>

              <div className="grid gap-3 md:grid-cols-2">
                {SCENARIOS.map((scenario) => {
                  const isSelected = data.scenario === scenario.value;
                  return (
                    <label
                      key={scenario.value}
                      className={`group relative cursor-pointer rounded-lg border-2 p-3 transition-all duration-200 hover:shadow-lg ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/5 shadow-emerald-500/20'
                          : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="scenario"
                        value={scenario.value}
                        checked={isSelected}
                        onChange={(e) => updateData({ scenario: e.target.value })}
                      />
                      
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-white">{scenario.label}</h3>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected 
                                ? 'border-emerald-500 bg-emerald-500' 
                                : 'border-neutral-500 group-hover:border-neutral-400'
                            }`}>
                              {isSelected && (
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-neutral-400">{scenario.description}</p>
                          
                          <div className="mt-1.5">
                            <span className={`inline-block px-1.5 py-0.5 text-xs rounded-full ${
                              isSelected 
                                ? 'bg-emerald-500/20 text-emerald-300' 
                                : 'bg-neutral-700 text-neutral-400'
                            }`}>
                              {scenario.value}
                            </span>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {data.scenario && (
                <div className="rounded-lg border border-emerald-700/40 bg-emerald-700/10 p-2">
                  <div className="text-xs text-emerald-300">
                    <span className="font-medium">Seçili senaryo:</span> {SCENARIOS.find(s => s.value === data.scenario)?.label}
                  </div>
                </div>
              )}
            </div>
          )}

          {current === 'cards' && (
            <div className="space-y-4">
              <header>
                <h2 className="text-base font-semibold">Kart Seçimi</h2>
                <p className="text-xs text-neutral-400">
                  Test kartı stratejisini belirleyin.
                </p>
              </header>
              
              <div className="space-y-2">
                <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  data.cardStrategy === 'automatic'
                    ? 'border-emerald-500 bg-emerald-500/5 shadow-emerald-500/20'
                    : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
                }`}>
                  <input 
                    type="radio" 
                    name="cardStrategy" 
                    value="automatic"
                    checked={data.cardStrategy === 'automatic'}
                    onChange={(e) => updateData({ cardStrategy: e.target.value as 'automatic' | 'manual' })}
                    className="mr-3" 
                  />
                  <div>
                    <div className="text-sm font-medium">Otomatik - Tüm Issuer'lar</div>
                    <div className="text-xs text-neutral-400">Her banka için farklı issuer kart kullan (10 issuer × seçili bankalar)</div>
                  </div>
                </label>

                <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  data.cardStrategy === 'manual'
                    ? 'border-emerald-500 bg-emerald-500/5 shadow-emerald-500/20'
                    : 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600'
                }`}>
                  <input 
                    type="radio" 
                    name="cardStrategy" 
                    value="manual"
                    checked={data.cardStrategy === 'manual'}
                    onChange={(e) => updateData({ cardStrategy: e.target.value as 'automatic' | 'manual' })}
                    className="mr-3" 
                  />
                  <div>
                    <div className="text-sm font-medium">Manuel</div>
                    <div className="text-xs text-neutral-400">Belirli kartları manuel seçim (şu anda desteklenmiyor)</div>
                  </div>
                </label>
              </div>

              {/* Parameters Preset ID */}
              <div>
                <label className="block text-xs font-medium mb-2 text-neutral-500">Test Parametreleri Preset</label>
                <select
                  value={data.parametersPresetId || 1}
                  onChange={(e) => updateData({ parametersPresetId: parseInt(e.target.value) })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value={1}>Preset 1 - Default</option>
                  <option value={2}>Preset 2 - Extended</option>
                  <option value={3}>Preset 3 - Minimal</option>
                </select>
                <p className="text-xs text-neutral-400 mt-1">
                  N8N workflow'unda DB'den çekilecek test parametreleri preset'i
                </p>
              </div>
            </div>
          )}

          {current === 'summary' && (
            <div className="space-y-3">
              <header>
                <h2 className="text-base font-semibold">Özet & Çalıştır</h2>
                <p className="text-xs text-neutral-400">
                  Ayarları kontrol edin ve testi başlatın.
                </p>
              </header>
              
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-neutral-500">Ortam</div>
                  <div className="mt-1 text-xs text-neutral-200">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      data.environment === 'STB' ? 'bg-orange-500/15 text-orange-300' : 'bg-red-500/15 text-red-300'
                    }`}>
                      {data.environment} ({data.environment === 'STB' ? 'Test' : 'Canlı'})
                    </span>
                  </div>
                </div>
                
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-neutral-500">Seçili Bankalar</div>
                  <div className="mt-1 text-xs text-neutral-200">{data.selectedBanks.length} adet</div>
                </div>
                
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-neutral-500">Senaryo</div>
                  <div className="mt-1 text-xs text-neutral-200">{SCENARIOS.find(s => s.value === data.scenario)?.label}</div>
                </div>
                
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-neutral-500">Kart Stratejisi</div>
                  <div className="mt-1 text-xs text-neutral-200">
                    {data.cardStrategy === 'automatic' ? 'Otomatik (Tüm Issuer\'lar)' : 'Manuel'}
                  </div>
                </div>
                
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-neutral-500">Preset ID</div>
                  <div className="mt-1 text-xs text-neutral-200">Preset {data.parametersPresetId || 1}</div>
                </div>
                
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                  <div className="text-[9px] uppercase tracking-wider text-neutral-500">Tahmini Süre</div>
                  <div className="mt-1 text-xs text-orange-400 font-medium">{estimatedDuration}</div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                <div className="text-xs font-medium mb-2 text-neutral-500">Seçili Bankalar</div>
                <div className="flex flex-wrap gap-1">
                  {data.selectedBanks.map(bankName => (
                    <span key={bankName} className="bg-neutral-700 px-2 py-1 rounded text-xs">
                      {bankName}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-orange-900/50 border border-orange-600/50 rounded-lg p-3">
                <div className="flex items-start">
                  <i className="fas fa-exclamation-triangle text-orange-400 mr-2 mt-0.5"></i>
                  <div className="text-xs">
                    <div className="font-medium text-orange-200">Uyarı</div>
                    <div className="text-orange-300">
                      Bu test {data.selectedBanks.length} banka için kapsamlı regresyon testleri çalıştıracaktır. 
                      İşlem tamamlanana kadar lütfen bekleyiniz.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-800 flex justify-between">
          <button 
            onClick={goPrev}
            className={`px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm font-medium transition-colors ${
              stepIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={stepIndex === 0}
          >
            <i className="fas fa-arrow-left mr-2"></i>Geri
          </button>
          
          {stepIndex < STEPS.length - 1 ? (
            <button 
              onClick={goNext}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                canNext ? 'bg-neutral-700 hover:bg-neutral-600' : 'bg-neutral-800 opacity-50 cursor-not-allowed'
              }`}
              disabled={!canNext}
            >
              İleri <i className="fas fa-arrow-right ml-2"></i>
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors"
            >
              <i className="fas fa-play mr-2"></i>Testi Başlat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
