import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import BankRegressionWizard from '../components/BankRegressionWizard';
import { startBankRegression } from '../lib/n8nClient';

interface BankStatus {
  bankName: string;
  channelId: string;
  status: 'active' | 'warning' | 'error' | 'pending';
  metrics: {
    sale: { success: number; total: number; rate: number };
    cancel: { success: number; total: number; rate: number };
    refund: { success: number; total: number; rate: number };
  };
  lastTest: string;
}

interface DashboardMetrics {
  activeBanks: number;
  totalBanks: number;
  overallSuccessRate: number;
  warnings: number;
  lastHourTransactions: number;
}

interface RecentActivity {
  id: string;
  message: string;
  status: 'success' | 'warning' | 'error' | 'running';
  timestamp: string;
}

interface WizardState {
  step: number;
  data: {
    environment: 'STB' | 'PRP';
    selectedBanks: string[];
    scenario: string;
    cardStrategy: string;
  };
}

export default function BankaRegressionBotu() {
  const navigate = useNavigate();
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({
    activeBanks: 8,
    totalBanks: 10,
    overallSuccessRate: 94.2,
    warnings: 2,
    lastHourTransactions: 156
  });

  const [bankStatuses, setBankStatuses] = useState<BankStatus[]>([
    {
      bankName: 'AKBANK',
      channelId: '200101',
      status: 'active',
      metrics: {
        sale: { success: 48, total: 50, rate: 96 },
        cancel: { success: 5, total: 5, rate: 100 },
        refund: { success: 3, total: 3, rate: 100 }
      },
      lastTest: '2 dk önce'
    },
    {
      bankName: 'DENİZBANK',
      channelId: '200102',
      status: 'warning',
      metrics: {
        sale: { success: 44, total: 50, rate: 88 },
        cancel: { success: 3, total: 3, rate: 100 },
        refund: { success: 3, total: 4, rate: 75 }
      },
      lastTest: '5 dk önce'
    },
    {
      bankName: 'GARANTİ',
      channelId: '200103',
      status: 'active',
      metrics: {
        sale: { success: 49, total: 50, rate: 98 },
        cancel: { success: 6, total: 6, rate: 100 },
        refund: { success: 4, total: 4, rate: 100 }
      },
      lastTest: '30 sn önce'
    },
    {
      bankName: 'VAKIFBANK',
      channelId: '200104',
      status: 'error',
      metrics: {
        sale: { success: 36, total: 50, rate: 72 },
        cancel: { success: 4, total: 5, rate: 80 },
        refund: { success: 1, total: 2, rate: 50 }
      },
      lastTest: '10 dk önce'
    },
    {
      bankName: 'KUVEYT',
      channelId: '200105',
      status: 'active',
      metrics: {
        sale: { success: 47, total: 50, rate: 94 },
        cancel: { success: 4, total: 4, rate: 100 },
        refund: { success: 2, total: 2, rate: 100 }
      },
      lastTest: '1 dk önce'
    },
    {
      bankName: 'HALKBANK',
      channelId: '200106',
      status: 'pending',
      metrics: {
        sale: { success: 0, total: 0, rate: 0 },
        cancel: { success: 0, total: 0, rate: 0 },
        refund: { success: 0, total: 0, rate: 0 }
      },
      lastTest: 'Henüz test yapılmadı'
    },
    {
      bankName: 'İŞBANK',
      channelId: '200107',
      status: 'pending',
      metrics: {
        sale: { success: 0, total: 0, rate: 0 },
        cancel: { success: 0, total: 0, rate: 0 },
        refund: { success: 0, total: 0, rate: 0 }
      },
      lastTest: 'Henüz test yapılmadı'
    },
    {
      bankName: 'ZIRAAT',
      channelId: '200108',
      status: 'pending',
      metrics: {
        sale: { success: 0, total: 0, rate: 0 },
        cancel: { success: 0, total: 0, rate: 0 },
        refund: { success: 0, total: 0, rate: 0 }
      },
      lastTest: 'Henüz test yapılmadı'
    },
    {
      bankName: 'QNB FİNANS',
      channelId: '200109',
      status: 'pending',
      metrics: {
        sale: { success: 0, total: 0, rate: 0 },
        cancel: { success: 0, total: 0, rate: 0 },
        refund: { success: 0, total: 0, rate: 0 }
      },
      lastTest: 'Henüz test yapılmadı'
    },
    {
      bankName: 'YAPIKRED',
      channelId: '200110',
      status: 'pending',
      metrics: {
        sale: { success: 0, total: 0, rate: 0 },
        cancel: { success: 0, total: 0, rate: 0 },
        refund: { success: 0, total: 0, rate: 0 }
      },
      lastTest: 'Henüz test yapılmadı'
    }
  ]);

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([
    {
      id: '1',
      message: 'AKBANK - Satış testi tamamlandı',
      status: 'success',
      timestamp: '2 dakika önce'
    },
    {
      id: '2', 
      message: 'DENİZBANK - İade testinde uyarı',
      status: 'warning',
      timestamp: '5 dakika önce'
    },
    {
      id: '3',
      message: 'VAKIFBANK - Satış testinde hata',
      status: 'error',
      timestamp: '10 dakika önce'
    }
  ]);

  const [showWizard, setShowWizard] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Bank Regression N8N payload builder
  function buildBankRegressionPayload(wizardData: any) {
    // Bank array (wizard'daki ile aynı)
    const banksData = [
      { name: 'AKBANK', channelId: '200101', bankCode: '046', issuerCode: '046', status: 'active' },
      { name: 'DENİZBANK', channelId: '200102', bankCode: '134', issuerCode: '134', status: 'warning' },
      { name: 'GARANTİ', channelId: '200103', bankCode: '062', issuerCode: '062', status: 'active' },
      { name: 'VAKIFBANK', channelId: '200104', bankCode: '015', issuerCode: '015', status: 'error' },
      { name: 'KUVEYT', channelId: '200105', bankCode: '205', issuerCode: '205', status: 'active' },
      { name: 'HALKBANK', channelId: '200106', bankCode: '012', issuerCode: '012', status: 'pending' },
      { name: 'İŞBANK', channelId: '200107', bankCode: '064', issuerCode: '064', status: 'pending' },
      { name: 'ZIRAAT', channelId: '200108', bankCode: '010', issuerCode: '010', status: 'pending' },
      { name: 'QNB FİNANS', channelId: '200109', bankCode: '111', issuerCode: '111', status: 'pending' },
      { name: 'YAPIKRED', channelId: '200110', bankCode: '067', issuerCode: '067', status: 'pending' },
    ];

    // Seçili banka isimlerini bank_code array'ine çevir
    const requestedBanks = wizardData.selectedBanks.map((bankName: string) => {
      const bank = banksData.find(b => b.name === bankName);
      return bank?.bankCode || bankName;
    });

    // Bank mapping for issuer codes (acquirer -> issuer mapping)
    const bankMapping = banksData.reduce((acc, bank) => {
      acc[bank.bankCode] = {
        name: bank.name,
        channelId: bank.channelId,
        issuerCode: bank.issuerCode // Default issuer same as acquirer
      };
      return acc;
    }, {} as Record<string, any>);

    return {
      env: wizardData.environment.toLowerCase(), // STB -> stb, PRP -> prp
      requested_banks: requestedBanks, // ['046', '134', '062'] format
      scenario: wizardData.scenario, // 'sale', 'cancel', 'refund', 'all'
      // Kanal kontrol botu yapısına uygun kart parametreleri
      cardSelectionMode: 'pre_selected', // Bank regression için özel mode
      card_strategy: 'per_bank_selection', // Her banka için ayrı kart seçimi
      parameters_preset_id: wizardData.parametersPresetId || 1, // Default preset
      segment: 'bank_regression', // Sabit segment
      userId: 'bank_regression_user',
      userName: 'Bank Regression Test',
      // Kanal kontrol botu gibi application structure
      application: {
        applicationName: 'BANK_REGRESSION',
        applicationPassword: 'regression123',
        secureCode: 'secure123',
        transactionId: `REG_${Date.now()}`,
        transactionDateTime: new Date().toISOString(),
      },
      // Kanal kontrol botu gibi payment structure
      payment: {
        paymentType: 'creditcard' as 'creditcard' | 'debitcard' | 'prepaidcard',
        threeDOperation: false,
        installmentNumber: 0,
        amount: 10,
        msisdn: '5303589836',
        userId: 'bank_regression_user',
        userName: 'Bank Regression Test',
        options: {
          includeMsisdnInOrderID: false,
          checkCBBLForMsisdn: true,
          checkCBBLForCard: true,
          checkFraudStatus: false,
        },
      },
      // Kanal kontrol botu gibi products structure
      products: [{
        amount: 10,
        msisdn: '5303589836',
      }],
      // Bank regression özel bilgiler
      bank_mapping: bankMapping, // Bank bilgileri mapping
      // Bank regression'a özel kart seçim kuralları
      card_selection_rules: {
        mode: 'per_bank_own_cards', // Her banka kendi kartlarını kullanır
        fallback_issuer: '999', // Kart bulunamazsa default issuer
        use_bank_own_cards: true // Bankanın kendi kartlarını kullan
      },
      // N8N workflow için action ve scenarios
      action: 'payment', // Bank regression payment ile başlar
      scenarios: [wizardData.scenario], // Scenario array format
      runMode: wizardData.scenario === 'all' ? 'all' : 'payment-only' // Run mode
    };
  }

  const handleWizardSubmit = async (wizardData: any) => {
    console.log('Bank Regression Wizard data submitted:', wizardData);
    
    try {
      // Kanal kontrol botu gibi payload oluştur
      const payload = buildBankRegressionPayload(wizardData);
      console.log('Bank Regression N8N Payload:', payload); // Debug için
      
      // N8N Bank Regression workflow başlatma
      const res = await startBankRegression(payload);
      
      // RunKey'den başındaki = işaretini temizle (kanal kontrol botu gibi)
      const cleanRunKey = res.runKey?.replace(/^=+/, '') || res.runKey;
      console.log(`[BankRegression] Original runKey: ${res.runKey}, Cleaned: ${cleanRunKey}`);
      
      // Test results sayfasına yönlendir
      const params = new URLSearchParams({
        runKey: cleanRunKey,
        flow: 'bankRegression',
        isAllFlow: 'false', // Bank regression tek akış
        wizardData: encodeURIComponent(JSON.stringify(wizardData))
      });
      
      navigate(`/test-results?${params.toString()}`);
      
      // Recent activities'e ekle
      setRecentActivities(prev => [{
        id: `REG_${Date.now()}`,
        message: `Banka Regresyon Testi: ${wizardData.selectedBanks.length} banka, ${wizardData.scenario}`,
        status: 'running',
        timestamp: 'Az önce başlatıldı'
      }, ...prev.slice(0, 4)]);
      
    } catch (error) {
      console.error('Bank regression test başlatma hatası:', error);
      alert("Bank Regression Start error: " + (error as Error).message);
      
      // Hata aktivitesi ekle
      setRecentActivities(prev => [{
        id: `REG_ERR_${Date.now()}`,
        message: `Banka Regresyon Testi başlatma hatası: ${(error as Error).message}`,
        status: 'error',
        timestamp: 'Az önce'
      }, ...prev.slice(0, 4)]);
    }
  };

  const getStatusColor = (status: BankStatus['status']) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'warning': return 'text-orange-400';
      case 'error': return 'text-red-400';
      case 'pending': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBadgeColor = (status: BankStatus['status']) => {
    switch (status) {
      case 'active': return 'bg-green-600';
      case 'warning': return 'bg-orange-600';
      case 'error': return 'bg-red-600';
      case 'pending': return 'bg-gray-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusText = (status: BankStatus['status']) => {
    switch (status) {
      case 'active': return 'AKTİF';
      case 'warning': return 'UYARI';
      case 'error': return 'HATA';
      case 'pending': return 'BEKLEMEDE';
      default: return 'BİLİNMEYEN';
    }
  };

  const getMetricColor = (rate: number) => {
    if (rate >= 95) return 'text-green-400';
    if (rate >= 80) return 'text-orange-400';
    return 'text-red-400';
  };

  const getActivityStatusColor = (status: RecentActivity['status']) => {
    switch (status) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-orange-400';
      case 'error': return 'text-red-400';
      case 'running': return 'text-gray-300';
      default: return 'text-gray-400';
    }
  };

  const getActivityStatusIcon = (status: RecentActivity['status']) => {
    switch (status) {
      case 'success': return 'fas fa-check-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      case 'running': return 'fas fa-spinner fa-spin';
      default: return 'fas fa-clock';
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const handleStartTest = () => {
    setShowWizard(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center">
          <i className="fas fa-university mr-2"></i>
          Banka Regresyon Botu
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Bankalar arası işlem durumu monitörü ve test otomasyonu
        </p>
      </div>

      {/* Control Panel */}
      <div className="!bg-gray-900 rounded-lg p-6 border border-gray-700" style={{backgroundColor: '#111827'}}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Kontrol Paneli</h2>
          <div className="flex gap-3">
            <button
              onClick={handleStartTest}
              className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <i className="fas fa-play mr-2"></i>
              Yeni Test Başlat
            </button>
            <button
              onClick={handleRefresh}
              className={`bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded-lg font-medium transition-colors flex items-center ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isRefreshing}
            >
              <i className={`fas fa-sync-alt mr-2 ${isRefreshing ? 'animate-spin' : ''}`}></i>
              Yenile
            </button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="!bg-gray-800 rounded-lg p-4 text-center border border-gray-700" style={{backgroundColor: '#1f2937'}}>
            <div className="text-2xl font-bold text-white">
              {dashboardMetrics.activeBanks}/{dashboardMetrics.totalBanks}
            </div>
            <div className="text-sm text-gray-300">Aktif Bankalar</div>
          </div>
          <div className="!bg-gray-800 rounded-lg p-4 text-center border border-gray-700" style={{backgroundColor: '#1f2937'}}>
            <div className="text-2xl font-bold text-white">
              %{dashboardMetrics.overallSuccessRate}
            </div>
            <div className="text-sm text-gray-300">Genel Başarı</div>
          </div>
          <div className="!bg-gray-800 rounded-lg p-4 text-center border border-gray-700" style={{backgroundColor: '#1f2937'}}>
            <div className="text-2xl font-bold text-orange-400">
              {dashboardMetrics.warnings}
            </div>
            <div className="text-sm text-gray-300">Uyarı</div>
          </div>
          <div className="!bg-gray-800 rounded-lg p-4 text-center border border-gray-700" style={{backgroundColor: '#1f2937'}}>
            <div className="text-2xl font-bold text-white">
              {dashboardMetrics.lastHourTransactions}
            </div>
            <div className="text-sm text-gray-300">Son 1 Saat</div>
          </div>
        </div>
      </div>

      {/* Bank Status Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {bankStatuses.map((bank) => (
          <div key={bank.bankName} className="!bg-gray-900 rounded-lg p-4 border border-gray-700" style={{backgroundColor: '#111827'}}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg">{bank.bankName}</h3>
              <span className={`${getStatusBadgeColor(bank.status)} text-xs px-2 py-1 rounded-full`}>
                {getStatusText(bank.status)}
              </span>
            </div>
            
            {bank.status !== 'pending' ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Satış:</span>
                  <span className={`${getMetricColor(bank.metrics.sale.rate)} font-medium`}>
                    %{bank.metrics.sale.rate} ({bank.metrics.sale.success}/{bank.metrics.sale.total})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">İptal:</span>
                  <span className={`${getMetricColor(bank.metrics.cancel.rate)} font-medium`}>
                    %{bank.metrics.cancel.rate} ({bank.metrics.cancel.success}/{bank.metrics.cancel.total})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">İade:</span>
                  <span className={`${getMetricColor(bank.metrics.refund.rate)} font-medium`}>
                    %{bank.metrics.refund.rate} ({bank.metrics.refund.success}/{bank.metrics.refund.total})
                  </span>
                </div>
                <div className="pt-2 text-xs text-gray-400">
                  Son Test: {bank.lastTest}
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-gray-500">
                <div>Henüz test yapılmadı</div>
                <div className="text-xs text-gray-400">Kanal: {bank.channelId}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="!bg-gray-900 rounded-lg p-6 border border-gray-700" style={{backgroundColor: '#111827'}}>
        <h3 className="text-lg font-semibold mb-4">Son Aktiviteler</h3>
        <div className="space-y-3">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0">
              <div className="flex items-center">
                <i className={`${getActivityStatusIcon(activity.status)} ${getActivityStatusColor(activity.status)} mr-3`}></i>
                <span>{activity.message}</span>
              </div>
              <span className="text-sm text-gray-400">{activity.timestamp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Wizard Modal */}
      <BankRegressionWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onSubmit={handleWizardSubmit}
      />
    </div>
  );
}
