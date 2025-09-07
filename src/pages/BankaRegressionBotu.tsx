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
    // BANKS mapping - bank names to codes
    const bankCodeMap: { [key: string]: string } = {
      'AKBANK': '046',
      'DENİZBANK': '134', 
      'GARANTİ': '062',
      'VAKIFBANK': '015',
      'KUVEYT': '205',
      'HALKBANK': '012',
      'İŞBANK': '064',
      'ZIRAAT': '010',
      'QNB FİNANS': '111',
      'YAPIKRED': '067'
    };

    // Convert bank names to codes if needed
    const requestedBanks = (wizardData.selectedBanks || []).map((bankName: string) => {
      return bankCodeMap[bankName] || bankName;
    });

    return {
      // Business logic parametreleri
      env: (wizardData.environment || 'STB').toString().toUpperCase(),
      requested_banks: requestedBanks, // bank codes array
      scenarios: [wizardData.scenario || 'all'], // scenarios as array
      card_strategy: wizardData.cardStrategy || 'automatic',
      cardSelectionMode: wizardData.cardStrategy || 'automatic',
      parameters_preset_id: wizardData.parametersPresetId || 1,
      manualCards: wizardData.cardStrategy === 'manual' ? (wizardData.manualCards || []) : [],
      // Eğer cancel/refund için manuel paymentId varsa
      paymentRef: wizardData.manualPaymentId ? { 
        paymentId: wizardData.manualPaymentId 
      } : undefined,
      amount: wizardData.amount || '100.00',
      msisdn: wizardData.msisdn || '905551112233'
    };
  }

  const handleWizardSubmit = async (wizardData: any) => {
    console.log('Bank Regression Wizard data submitted:', wizardData);

    try {
      // Build payload and call regression orchestrator (My workflow 9)
      const payload = buildBankRegressionPayload(wizardData);
      console.log('Orchestration payload:', payload);

      // Call the regression orchestrator
      const res: any = await startBankRegression(payload);
      console.log('Orchestrator response (full object):', res);
      console.log('Orchestrator response keys:', Object.keys(res));
      console.log('res.runKey:', res.runKey);
      console.log('res.run_key:', res.run_key);
      console.log('res.data:', res.data);
      
      // Response'dan runKey al (My workflow 9'dan dönen format) - API'den döndüğü şekliyle kullan
      const runKey = res.runKey || res.run_key || (res.data && res.data.runKey) || (res.data && res.data.run_key);
      
      console.log('🔍 RunKey detection:', {
        'res.runKey': res.runKey,
        'res.run_key': res.run_key,
        'res.data?.runKey': res.data?.runKey,
        'res.data?.run_key': res.data?.run_key,
        'final runKey': runKey,
        'response type': typeof res,
        'response keys': Object.keys(res)
      });
      
      if (!runKey) {
        console.error('runKey bulunamadı! Response object:', JSON.stringify(res, null, 2));
        console.warn('n8n workflow HTTP Response node eksik - geçici execution ID kullanılıyor');
        
        // n8n execution başladı ama response döndürmedi
        // Gerçek execution pattern'i oluştur
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const tempRunKey = `reg-${timestamp}-${randomSuffix}`;
        console.log('⚠️ Using fallback runKey (n8n response eksik):', tempRunKey);
        
        // Session storage'a kaydet
        sessionStorage.setItem('bankRegression_runKey', tempRunKey);
        sessionStorage.setItem('bankRegression_payload', JSON.stringify(payload));
        
        // Test results sayfasına yönlendir
        const params = new URLSearchParams({ 
          runKey: tempRunKey,
          flow: 'bankRegression'
        });
        navigate(`/test-results?${params.toString()}`);
        return;
      }
      
      console.log('Received runKey from API:', runKey);
      
      // Session storage'a kaydet
      sessionStorage.setItem('bankRegression_runKey', runKey);
      sessionStorage.setItem('bankRegression_payload', JSON.stringify(payload));
      
      // Test results sayfasına yönlendir
      const params = new URLSearchParams({ 
        runKey: runKey,
        flow: 'bankRegression'
      });
      navigate(`/test-results?${params.toString()}`);

      // Recent activities'e ekle
      setRecentActivities(prev => [{
        id: runKey,
        message: `Banka Regresyon Testi başlatıldı: ${wizardData.selectedBanks?.length || 0} banka, ${wizardData.scenario}`,
        status: 'running',
        timestamp: 'Az önce'
      }, ...prev.slice(0, 4)]);

      setShowWizard(false);
    } catch (error) {
      console.error('Bank regression start error:', error);
      const em = (error as Error).message || 'Başlatma hatası';
      alert("Bank Regression Start error: " + em);
      setRecentActivities(prev => [{
        id: `REG_ERR_${Date.now()}`,
        message: `Banka Regresyon Testi başlatma hatası: ${em}`,
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
