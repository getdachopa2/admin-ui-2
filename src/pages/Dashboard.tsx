import { useState, useEffect } from 'react';
import { listCandidates } from '@/lib/n8nClient';
import Modal from '@/components/Modal';

interface DashboardMetrics {
  todayRuns: number;
  successfulPayments: number;
  cancellations: number;
  successRate: number;
  yesterdayRuns?: number;
  yesterdayPayments?: number;
  yesterdayCancellations?: number;
  yesterdaySuccessRate?: number;
}

interface Transaction {
  id: string;
  order_id?: string;
  amount: string;
  status: string;
  time: string;
  card: string;
  executionId?: string;
  raw_amount?: number;
  success_bool?: boolean;
  created_at?: string;
  issuer_bank_code?: string;
  card_token?: string;
  result_code?: string;
}

interface Cancellation {
  id: string;
  order_id?: string;
  amount: string;
  type: string;
  time: string;
  reason: string;
  executionId?: string;
  raw_amount?: number;
  success_bool?: boolean;
  created_at?: string;
  cancel_date?: string;
  refund_date?: string;
  issuer_bank_code?: string;
  card_token?: string;
  cancel_result_code?: string;
  refund_result_code?: string;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    todayRuns: 0,
    successfulPayments: 0,
    cancellations: 0,
    successRate: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [recentCancellations, setRecentCancellations] = useState<Cancellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedCancellation, setSelectedCancellation] = useState<Cancellation | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Bugünün tarihini al
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Veritabanından payment_log verilerini çek
      try {
        const response = await fetch('/api/dashboard/metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            today,
            yesterday
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const dashboardData = await response.json();
        console.log('Dashboard API Response:', dashboardData);
        
        if (dashboardData.success) {
          console.log('Setting data:', {
            metrics: dashboardData.metrics,
            recentTransactions: dashboardData.recentTransactions,
            recentCancellations: dashboardData.recentCancellations
          });
          setMetrics(dashboardData.metrics);
          setRecentTransactions(dashboardData.recentTransactions || []);
          setRecentCancellations(dashboardData.recentCancellations || []);
        } else {
          throw new Error(dashboardData.message || 'API hatası');
        }
        
      } catch (apiError) {
        console.warn('Dashboard API hatası, fallback veriler kullanılıyor:', apiError);
        
        // API olmadığı durum için fallback - candidate verisinden iptal/iade sayısını al
        try {
          const cancelCandidates = await listCandidates({
            action: 'cancel',
            channelId: 'test',
            from: today,
            to: today,
            limit: 10
          });
          
          const refundCandidates = await listCandidates({
            action: 'refund', 
            channelId: 'test',
            from: today,
            to: today,
            limit: 10
          });
          
          // Mock metrikler
          const mockMetrics = {
            todayRuns: Math.floor(Math.random() * 20) + 5,
            successfulPayments: Math.floor(Math.random() * 15) + 3,
            cancellations: cancelCandidates.length + refundCandidates.length,
            successRate: Math.floor(Math.random() * 30) + 70,
            yesterdayRuns: Math.floor(Math.random() * 18) + 4,
            yesterdayPayments: Math.floor(Math.random() * 12) + 2,
            yesterdayCancellations: Math.floor(Math.random() * 5) + 1,
            yesterdaySuccessRate: Math.floor(Math.random() * 25) + 65,
          };
          
          setMetrics(mockMetrics);
          
          // Son 5 ödeme işlemi (mock data)
          const mockTransactions: Transaction[] = Array.from({ length: 5 }, (_, i) => ({
            id: `pay_${Date.now()}_${i}`,
            amount: `${(Math.random() * 500 + 50).toFixed(2)} TL`,
            status: Math.random() > 0.2 ? 'Başarılı' : 'Hata',
            time: new Date(Date.now() - i * 15 * 60 * 1000).toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            card: `****${Math.floor(Math.random() * 9000) + 1000}`,
          }));
          
          // Gerçek candidate verilerinden iptal/iade listesi
          const realCancellations: Cancellation[] = [
            ...cancelCandidates.slice(0, 3).map(candidate => ({
              id: candidate.paymentId,
              amount: `${candidate.amount} TL`,
              type: 'İptal',
              time: new Date(candidate.createdAt).toLocaleTimeString('tr-TR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }),
              reason: 'Müşteri talebi',
            })),
            ...refundCandidates.slice(0, 2).map(candidate => ({
              id: candidate.paymentId,
              amount: `${candidate.amount} TL`,
              type: 'İade',
              time: new Date(candidate.createdAt).toLocaleTimeString('tr-TR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }),
              reason: 'İade talebi',
            }))
          ];
          
          setRecentTransactions(mockTransactions);
          setRecentCancellations(realCancellations);
          
        } catch (candidateError) {
          console.warn('Candidate verileri de alınamadı, tamamen mock data kullanılıyor:', candidateError);
          
          // Tamamen mock data
          setMetrics({
            todayRuns: 8,
            successfulPayments: 6,
            cancellations: 2,
            successRate: 75,
            yesterdayRuns: 10,
            yesterdayPayments: 7,
            yesterdayCancellations: 3,
            yesterdaySuccessRate: 70,
          });
          
          // Mock transaction verisi
          const mockTransactions: Transaction[] = Array.from({ length: 5 }, (_, i) => ({
            id: `mock_pay_${Date.now()}_${i}`,
            amount: `${(Math.random() * 400 + 100).toFixed(2)} TL`,
            status: Math.random() > 0.15 ? 'Başarılı' : 'Hata',
            time: new Date(Date.now() - i * 20 * 60 * 1000).toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            card: `****${Math.floor(Math.random() * 9000) + 1000}`,
          }));
          
          // Mock cancellation verisi
          const mockCancellations: Cancellation[] = Array.from({ length: 3 }, (_, i) => ({
            id: `mock_cancel_${Date.now()}_${i}`,
            amount: `${(Math.random() * 300 + 50).toFixed(2)} TL`,
            type: i % 2 === 0 ? 'İptal' : 'İade',
            time: new Date(Date.now() - i * 30 * 60 * 1000).toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            reason: i % 2 === 0 ? 'Müşteri talebi' : 'İade talebi',
          }));
          
          setRecentTransactions(mockTransactions);
          setRecentCancellations(mockCancellations);
        }
      }
      
    } catch (error) {
      console.error('Dashboard verisi yüklenirken hata:', error);
      
      // Hata durumunda mock data
      setMetrics({
        todayRuns: 5,
        successfulPayments: 4,
        cancellations: 1,
        successRate: 80,
      });
      setRecentTransactions([]);
      setRecentCancellations([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateChange = (current: number, previous?: number) => {
    if (!previous) return '';
    const change = current - previous;
    if (change > 0) return `+${change}`;
    if (change < 0) return `${change}`;
    return '0';
  };

  const calculatePercentageChange = (current: number, previous?: number) => {
    if (!previous) return '';
    const change = current - previous;
    if (change > 0) return `+${change}%`;
    if (change < 0) return `${change}%`;
    return '0%';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
          <h1 className="mb-2 text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-neutral-400">
            Veriler yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
        <h1 className="mb-2 text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-neutral-400">
          Genel durum, son işlemler ve özet raporlar.
        </p>
      </div>

      {/* Metrik kartları */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard 
          title="Bugünkü Koşular" 
          value={metrics.todayRuns.toString()} 
          change={calculateChange(metrics.todayRuns, metrics.yesterdayRuns)} 
        />
        <MetricCard 
          title="Başarılı Ödeme" 
          value={metrics.successfulPayments.toString()} 
          change={calculateChange(metrics.successfulPayments, metrics.yesterdayPayments)} 
        />
        <MetricCard 
          title="İptal/İade" 
          value={metrics.cancellations.toString()} 
          change={calculateChange(metrics.cancellations, metrics.yesterdayCancellations)} 
        />
        <MetricCard 
          title="Başarı Oranı" 
          value={`${metrics.successRate}%`} 
          change={calculatePercentageChange(metrics.successRate, metrics.yesterdaySuccessRate)} 
        />
      </div>

      {/* Son işlemler */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTransactions 
          transactions={recentTransactions} 
          onTransactionClick={setSelectedTransaction}
        />
        <RecentCancellations 
          cancellations={recentCancellations} 
          onCancellationClick={setSelectedCancellation}
        />
      </div>

      {/* Changelog Card */}
      <div className="rounded-2xl border border-neutral-800 bg-gradient-to-r from-violet-900/20 to-purple-900/20 p-6 border-violet-700/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-violet-100 mb-2">📋 Changelog</h2>
            <p className="text-sm text-violet-300 mb-4">
              Son güncellemeler ve yeni özellikler
            </p>
            <div className="space-y-2 text-xs text-violet-200/80">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✨</span>
                <span>HTML Export Tam Expanded Format</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">⚡</span>
                <span>Dashboard ve Metrik API Ayrımı</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">⚡</span>
                <span>İkon Sadeleştirmesi ve Scale Küçültme</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <a 
              href="/changelog" 
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors font-medium"
            >
              Tümünü Gör
            </a>
            <div className="text-xs text-violet-300 text-center">v2.1.0</div>
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      <Modal
        open={selectedTransaction !== null}
        onClose={() => setSelectedTransaction(null)}
        title="Ödeme Detayları"
      >
        {selectedTransaction && (
          <TransactionDetail 
            transaction={selectedTransaction} 
            onClose={() => setSelectedTransaction(null)}
          />
        )}
      </Modal>

      {/* Cancellation Detail Modal */}
      <Modal
        open={selectedCancellation !== null}
        onClose={() => setSelectedCancellation(null)}
        title="İptal/İade Detayları"
      >
        {selectedCancellation && (
          <CancellationDetail 
            cancellation={selectedCancellation} 
            onClose={() => setSelectedCancellation(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function MetricCard({ title, value, change }: { title: string; value: string; change: string }) {
  const isPositive = change.startsWith('+');
  const isNegative = change.startsWith('-');
  
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="text-xs text-neutral-400">{title}</div>
      <div className="mt-2 flex items-end gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        <div className={`text-xs ${
          isPositive ? 'text-green-400' : 
          isNegative ? 'text-red-400' : 
          'text-neutral-400'
        }`}>
          {change}
        </div>
      </div>
    </div>
  );
}

function RecentTransactions({ 
  transactions, 
  onTransactionClick 
}: { 
  transactions: Transaction[];
  onTransactionClick: (transaction: Transaction) => void;
}) {
  console.log('RecentTransactions received:', transactions.length, 'transactions');
  
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
        <h2 className="mb-4 text-lg font-semibold">Son 5 Ödeme</h2>
        <div className="text-center text-sm text-neutral-400 py-8">
          Bugün henüz ödeme işlemi yapılmamış
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
      <h2 className="mb-4 text-lg font-semibold">Son 5 Ödeme</h2>
      <div className="space-y-3">
        {transactions.map((payment) => (
          <div 
            key={payment.id} 
            className="flex items-center justify-between rounded-lg bg-neutral-800/50 p-3 cursor-pointer hover:bg-neutral-800/70 transition-colors"
            onClick={() => onTransactionClick(payment)}
          >
            <div className="flex flex-col">
              <div className="text-sm font-medium">{payment.amount}</div>
              <div className="text-xs text-neutral-400">
                Payment ID: {payment.id}
                {payment.order_id && ` • Order ID: ${payment.order_id}`}
              </div>
              <div className="text-xs text-neutral-400">{payment.card} • {payment.time}</div>
            </div>
            <div className={`rounded-full px-2 py-1 text-xs ${
              payment.status === 'Başarılı' 
                ? 'bg-green-900/50 text-green-400' 
                : 'bg-red-900/50 text-red-400'
            }`}>
              {payment.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentCancellations({ 
  cancellations, 
  onCancellationClick 
}: { 
  cancellations: Cancellation[];
  onCancellationClick: (cancellation: Cancellation) => void;
}) {
  console.log('RecentCancellations received:', cancellations.length, 'cancellations');
  
  if (cancellations.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
        <h2 className="mb-4 text-lg font-semibold">Son 5 İptal/İade</h2>
        <div className="text-center text-sm text-neutral-400 py-8">
          Bugün henüz iptal/iade işlemi yapılmamış
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
      <h2 className="mb-4 text-lg font-semibold">Son 5 İptal/İade</h2>
      <div className="space-y-3">
        {cancellations.map((cancellation) => (
          <div 
            key={cancellation.id} 
            className="flex items-center justify-between rounded-lg bg-neutral-800/50 p-3 cursor-pointer hover:bg-neutral-800/70 transition-colors"
            onClick={() => onCancellationClick(cancellation)}
          >
            <div className="flex flex-col">
              <div className="text-sm font-medium">{cancellation.amount}</div>
              <div className="text-xs text-neutral-400">
                Payment ID: {cancellation.id}
                {cancellation.order_id && ` • Order ID: ${cancellation.order_id}`}
              </div>
              <div className="text-xs text-neutral-400">{cancellation.reason} • {cancellation.time}</div>
            </div>
            <div className={`rounded-full px-2 py-1 text-xs ${
              cancellation.type === 'İptal' 
                ? 'bg-orange-900/50 text-orange-400' 
                : 'bg-blue-900/50 text-blue-400'
            }`}>
              {cancellation.type}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionDetail({ 
  transaction, 
  onClose 
}: { 
  transaction: Transaction;
  onClose: () => void;
}) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('tr-TR');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">Payment ID</div>
            <div className="text-sm font-mono">{transaction.id}</div>
          </div>
          
          {transaction.order_id && (
            <div className="rounded-lg bg-neutral-800/30 p-3">
              <div className="text-xs text-neutral-400 mb-1">Order ID</div>
              <div className="text-sm font-mono">{transaction.order_id}</div>
            </div>
          )}
          
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">Tutar</div>
            <div className="text-sm font-medium">{transaction.amount}</div>
          </div>
          
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">Durum</div>
            <div className={`inline-flex rounded-full px-2 py-1 text-xs ${
              transaction.status === 'Başarılı' 
                ? 'bg-green-900/50 text-green-400' 
                : 'bg-red-900/50 text-red-400'
            }`}>
              {transaction.status}
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">Kart</div>
            <div className="text-sm">{transaction.card}</div>
          </div>
          
          {transaction.issuer_bank_code && (
            <div className="rounded-lg bg-neutral-800/30 p-3">
              <div className="text-xs text-neutral-400 mb-1">Banka Kodu</div>
              <div className="text-sm font-mono">{transaction.issuer_bank_code}</div>
            </div>
          )}
          
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">İşlem Zamanı</div>
            <div className="text-sm">{formatDate(transaction.created_at)}</div>
          </div>
          
          {transaction.card_token && (
            <div className="rounded-lg bg-neutral-800/30 p-3">
              <div className="text-xs text-neutral-400 mb-1">Card Token</div>
              <div className="text-sm font-mono">{transaction.card_token}</div>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        <button 
          onClick={onClose}
          className="px-4 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

function CancellationDetail({ 
  cancellation, 
  onClose 
}: { 
  cancellation: Cancellation;
  onClose: () => void;
}) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('tr-TR');
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">Payment ID</div>
            <div className="text-sm font-mono">{cancellation.id}</div>
          </div>
          
          {cancellation.order_id && (
            <div className="rounded-lg bg-neutral-800/30 p-3">
              <div className="text-xs text-neutral-400 mb-1">Order ID</div>
              <div className="text-sm font-mono">{cancellation.order_id}</div>
            </div>
          )}
          
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">Tutar</div>
            <div className="text-sm font-medium">{cancellation.amount}</div>
          </div>
          
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">İşlem Tipi</div>
            <div className={`inline-flex rounded-full px-2 py-1 text-xs ${
              cancellation.type === 'İptal' 
                ? 'bg-orange-900/50 text-orange-400' 
                : 'bg-blue-900/50 text-blue-400'
            }`}>
              {cancellation.type}
            </div>
          </div>
          
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">Sebep</div>
            <div className="text-sm">{cancellation.reason}</div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="rounded-lg bg-neutral-800/30 p-3">
            <div className="text-xs text-neutral-400 mb-1">Oluşturulma Zamanı</div>
            <div className="text-sm">{formatDate(cancellation.created_at)}</div>
          </div>
          
          {cancellation.cancel_date && (
            <div className="rounded-lg bg-neutral-800/30 p-3">
              <div className="text-xs text-neutral-400 mb-1">İptal Zamanı</div>
              <div className="text-sm">{formatDate(cancellation.cancel_date)}</div>
            </div>
          )}
          
          {cancellation.refund_date && (
            <div className="rounded-lg bg-neutral-800/30 p-3">
              <div className="text-xs text-neutral-400 mb-1">İade Zamanı</div>
              <div className="text-sm">{formatDate(cancellation.refund_date)}</div>
            </div>
          )}
          
          {cancellation.issuer_bank_code && (
            <div className="rounded-lg bg-neutral-800/30 p-3">
              <div className="text-xs text-neutral-400 mb-1">Banka Kodu</div>
              <div className="text-sm font-mono">{cancellation.issuer_bank_code}</div>
            </div>
          )}
          
          {cancellation.cancel_result_code && (
            <div className="rounded-lg bg-neutral-800/30 p-3">
              <div className="text-xs text-neutral-400 mb-1">İptal Sonuç Kodu</div>
              <div className="text-sm font-mono">{cancellation.cancel_result_code}</div>
            </div>
          )}

          {cancellation.refund_result_code && (
            <div className="rounded-lg bg-neutral-800/30 p-3">
              <div className="text-xs text-neutral-400 mb-1">İade Sonuç Kodu</div>
              <div className="text-sm font-mono">{cancellation.refund_result_code}</div>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-end pt-4">
        <button 
          onClick={onClose}
          className="px-4 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

