import React, { useState, useEffect } from 'react';

const API_BASE = String(import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5701').replace(/\/$/, '');
const BASIC_RAW = String(import.meta.env.VITE_N8N_BASIC || '');

// Helper function for API calls
async function apiCall(endpoint: string, data?: any) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (BASIC_RAW) {
    headers.Authorization = 'Basic ' + btoa(BASIC_RAW);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: data ? 'POST' : 'GET',
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

interface TableDiff {
  tableName: string;
  added: any[];
  modified: any[];
  deleted: any[];
  lastChecked: string;
}

interface ComparisonResult {
  table1: TableDiff;
  table2: TableDiff;
  table3: TableDiff;
  summary: {
    totalDifferences: number;
    lastSync: string;
  };
}

export default function ParametreDurumKontrol() {
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const checkTableDifferences = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // N8N'e tablo karşılaştırma isteği gönder
      const data = await apiCall('/webhook/check-table-differences', {
        tables: ['table1', 'table2', 'table3'], // Gerçek tablo isimlerini buraya yazın
        timestamp: new Date().toISOString()
      });

      setComparisonResult(data);
      setLastRefresh(new Date().toLocaleString('tr-TR'));
    } catch (err) {
      console.error('Tablo karşılaştırma hatası:', err);
      setError('Tablo karşılaştırması sırasında bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Sayfa yüklendiğinde otomatik kontrol
    checkTableDifferences();
  }, []);

  const getDiffCount = (diff: TableDiff) => {
    return diff.added.length + diff.modified.length + diff.deleted.length;
  };

  const getDiffStatusColor = (count: number) => {
    if (count === 0) return 'text-green-400 bg-green-400/10 border-green-400/30';
    if (count <= 5) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    return 'text-red-400 bg-red-400/10 border-red-400/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Parametre Durum Kontrol</h1>
          <p className="text-neutral-400 mt-1">
            Veritabanı tablolarındaki değişiklikleri takip edin
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-neutral-400">
              Son kontrol: {lastRefresh}
            </span>
          )}
          <button
            onClick={checkTableDifferences}
            disabled={isLoading}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {isLoading ? 'Kontrol Ediliyor...' : '🔄 Yenile'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="card p-4 border-red-500/30 bg-red-500/10">
          <div className="flex items-center gap-2 text-red-400">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !comparisonResult && (
        <div className="card p-8 text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-neutral-400">Tablolar karşılaştırılıyor...</p>
        </div>
      )}

      {/* Results */}
      {comparisonResult && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="text-2xl font-bold text-white">
                {comparisonResult.summary.totalDifferences}
              </div>
              <div className="text-sm text-neutral-400">Toplam Fark</div>
            </div>
            
            <div className="card p-4">
              <div className="text-lg font-bold text-green-400">
                {getDiffCount(comparisonResult.table1)}
              </div>
              <div className="text-sm text-neutral-400">Tablo 1 Farkları</div>
            </div>
            
            <div className="card p-4">
              <div className="text-lg font-bold text-blue-400">
                {getDiffCount(comparisonResult.table2)}
              </div>
              <div className="text-sm text-neutral-400">Tablo 2 Farkları</div>
            </div>
            
            <div className="card p-4">
              <div className="text-lg font-bold text-purple-400">
                {getDiffCount(comparisonResult.table3)}
              </div>
              <div className="text-sm text-neutral-400">Tablo 3 Farkları</div>
            </div>
          </div>

          {/* Table Differences */}
          <div className="space-y-6">
            {[comparisonResult.table1, comparisonResult.table2, comparisonResult.table3].map((tableDiff, index) => (
              <TableDiffComponent 
                key={index} 
                diff={tableDiff} 
                tableIndex={index + 1}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Ayrı component for table differences
function TableDiffComponent({ diff, tableIndex }: { diff: TableDiff; tableIndex: number }) {
  const [expandedSection, setExpandedSection] = useState<'added' | 'modified' | 'deleted' | null>(null);
  
  const diffCount = diff.added.length + diff.modified.length + diff.deleted.length;
  const statusColor = diffCount === 0 
    ? 'border-green-500/30 bg-green-500/10' 
    : diffCount <= 5 
    ? 'border-yellow-500/30 bg-yellow-500/10'
    : 'border-red-500/30 bg-red-500/10';

  return (
    <div className={`card border ${statusColor}`}>
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {diff.tableName || `Tablo ${tableIndex}`}
            </h3>
            <p className="text-sm text-neutral-400">
              Son kontrol: {new Date(diff.lastChecked).toLocaleString('tr-TR')}
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{diffCount}</div>
            <div className="text-xs text-neutral-400">toplam fark</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Added items */}
        {diff.added.length > 0 && (
          <DiffSection
            title="Eklenen"
            count={diff.added.length}
            color="green"
            items={diff.added}
            isExpanded={expandedSection === 'added'}
            onToggle={() => setExpandedSection(expandedSection === 'added' ? null : 'added')}
          />
        )}

        {/* Modified items */}
        {diff.modified.length > 0 && (
          <DiffSection
            title="Değişen"
            count={diff.modified.length}
            color="yellow"
            items={diff.modified}
            isExpanded={expandedSection === 'modified'}
            onToggle={() => setExpandedSection(expandedSection === 'modified' ? null : 'modified')}
          />
        )}

        {/* Deleted items */}
        {diff.deleted.length > 0 && (
          <DiffSection
            title="Silinen"
            count={diff.deleted.length}
            color="red"
            items={diff.deleted}
            isExpanded={expandedSection === 'deleted'}
            onToggle={() => setExpandedSection(expandedSection === 'deleted' ? null : 'deleted')}
          />
        )}

        {diffCount === 0 && (
          <div className="text-center py-8 text-green-400">
            ✅ Bu tabloda fark bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}

// Component for each diff section (added/modified/deleted)
function DiffSection({ 
  title, 
  count, 
  color, 
  items, 
  isExpanded, 
  onToggle 
}: {
  title: string;
  count: number;
  color: 'green' | 'yellow' | 'red';
  items: any[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colorClasses = {
    green: 'text-green-400 bg-green-400/10 border-green-400/30',
    yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    red: 'text-red-400 bg-red-400/10 border-red-400/30'
  };

  const icons = {
    green: '➕',
    yellow: '📝',
    red: '➖'
  };

  return (
    <div className={`border rounded-lg ${colorClasses[color]}`}>
      <button
        onClick={onToggle}
        className="w-full p-3 text-left flex items-center justify-between hover:bg-white/5 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{icons[color]}</span>
          <span className="font-medium">{title}</span>
          <span className="text-sm opacity-80">({count})</span>
        </div>
        <span className="text-lg">{isExpanded ? '−' : '+'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-current/20 p-3 max-h-96 overflow-auto">
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="p-2 bg-black/20 rounded text-sm font-mono">
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
